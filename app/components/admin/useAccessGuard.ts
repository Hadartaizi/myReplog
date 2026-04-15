import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../database/firebase';
import { getAccessState, parseAccessDate } from './accessUtils';
import type { UserRole, UserDoc } from "../../types/user";

export default function useAccessGuard() {
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    let expiryTimeout: ReturnType<typeof setTimeout> | null = null;
    let isLoggingOut = false;
    let isMounted = true;

    const showMessage = (title: string, message: string) => {
      if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
      } else {
        Alert.alert(title, message);
      }
    };

    const clearExpiryTimeout = () => {
      if (expiryTimeout) {
        clearTimeout(expiryTimeout);
        expiryTimeout = null;
      }
    };

    const logoutNow = async (
      message?: string,
      title: string = 'אין גישה למערכת'
    ) => {
      if (isLoggingOut) return;
      isLoggingOut = true;

      try {
        clearExpiryTimeout();

        if (message) {
          showMessage(title, message);
        }

        await signOut(auth);
      } catch (error) {
        console.error('שגיאה בהתנתקות אוטומטית:', error);
      } finally {
        if (isMounted) {
          setCheckingAccess(false);
        }
        router.replace('/');
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      clearExpiryTimeout();

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!user) {
        if (isMounted) {
          setCheckingAccess(false);
        }
        return;
      }

      if (isMounted) {
        setCheckingAccess(true);
      }

      unsubscribeDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (!snap.exists()) {
            logoutNow('לא נמצאו פרטי משתמש. יש להתחבר מחדש.', 'שגיאה');
            return;
          }

          const data = snap.data();

          console.log('GUARD user data:', data);
          console.log('GUARD accessStartAt raw:', data?.accessStartAt);
          console.log('GUARD accessEndAt raw:', data?.accessEndAt);
          console.log('GUARD device now:', new Date().toISOString());

          const accessState = getAccessState(data);

          console.log('GUARD accessState:', accessState);

          if (!accessState.allowed) {
            if (accessState.reason === 'blocked') {
              logoutNow(
                'הגישה שלך למערכת נחסמה על ידי מנהל המערכת.',
                'החשבון חסום'
              );
              return;
            }

            if (accessState.reason === 'pending_approval') {
              logoutNow(
                'ההרשמה בוצעה בהצלחה. יש להמתין לאישור סופי ממנהל המערכת.',
                'החשבון עדיין לא אושר'
              );
              return;
            }

            if (accessState.reason === 'expired') {
              logoutNow(
                'תקופת הגישה שהוגדרה עבורך הסתיימה.',
                'הגישה הסתיימה'
              );
              return;
            }

            if (accessState.reason === 'not_started_yet') {
              logoutNow(
                'תקופת הגישה שלך עדיין לא התחילה.',
                'הגישה עדיין לא התחילה'
              );
              return;
            }

            if (accessState.reason === 'invalid_access_start') {
              logoutNow(
                'תאריך תחילת הגישה שהוגדר עבורך אינו תקין.',
                'שגיאת גישה'
              );
              return;
            }

            if (accessState.reason === 'invalid_access_end') {
              logoutNow(
                'תאריך סיום הגישה שהוגדר עבורך אינו תקין.',
                'שגיאת גישה'
              );
              return;
            }

            logoutNow('אין כרגע הרשאת גישה למערכת.', 'אין גישה למערכת');
            return;
          }

          clearExpiryTimeout();

          if (isMounted) {
            setCheckingAccess(false);
          }

          if (data.role !== 'admin' && data.accessEndAt) {
            const endDate = parseAccessDate(data.accessEndAt);

            console.log('GUARD parsed endDate:', endDate?.toISOString?.());

            if (!endDate) {
              logoutNow(
                'תאריך סיום הגישה שהוגדר עבורך אינו תקין.',
                'שגיאת גישה'
              );
              return;
            }

            const now = Date.now();
            const delay = endDate.getTime() - now;

            console.log('GUARD delay ms:', delay);
            console.log('GUARD endDate ms:', endDate.getTime());
            console.log('GUARD now ms:', now);

            if (delay <= -10000) {
              logoutNow(
                'תקופת הגישה שהוגדרה עבורך הסתיימה.',
                'הגישה הסתיימה'
              );
              return;
            }

            if (delay > 0) {
              expiryTimeout = setTimeout(() => {
                logoutNow(
                  'תקופת הגישה שהוגדרה עבורך הסתיימה.',
                  'הגישה הסתיימה'
                );
              }, delay);
            }
          }
        },
        (error) => {
          console.error('שגיאה במעקב אחרי הרשאת גישה:', error);
          if (isMounted) {
            setCheckingAccess(false);
          }
        }
      );
    });

    return () => {
      isMounted = false;
      clearExpiryTimeout();
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  return { checkingAccess };
}