import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../database/firebase';
import { getAccessState } from './accessUtils';

export default function useAccessGuard() {
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    let expiryTimeout: ReturnType<typeof setTimeout> | null = null;
    let isLoggingOut = false;

    const showMessage = (message: string) => {
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('אין גישה למערכת', message);
      }
    };

    const clearExpiryTimeout = () => {
      if (expiryTimeout) {
        clearTimeout(expiryTimeout);
        expiryTimeout = null;
      }
    };

    const logoutNow = async (message?: string) => {
      if (isLoggingOut) return;
      isLoggingOut = true;

      try {
        clearExpiryTimeout();

        if (message) {
          showMessage(message);
        }

        await signOut(auth);
        router.replace('/');
      } catch (error) {
        console.error('שגיאה בהתנתקות אוטומטית:', error);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      clearExpiryTimeout();

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!user) {
        setCheckingAccess(false);
        return;
      }

      setCheckingAccess(true);

      unsubscribeDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (!snap.exists()) {
            setCheckingAccess(false);
            logoutNow('לא נמצאו פרטי משתמש. יש להתחבר מחדש.');
            return;
          }

          const data = snap.data();
          const accessState = getAccessState(data);

          if (!accessState.allowed) {
            setCheckingAccess(false);

            if (accessState.reason === 'blocked') {
              logoutNow('הגישה שלך למערכת נחסמה על ידי מנהל המערכת.');
              return;
            }

            if (accessState.reason === 'pending_approval') {
              logoutNow('החשבון עדיין ממתין לאישור מנהל.');
              return;
            }

            if (accessState.reason === 'expired') {
              logoutNow('תקופת הגישה שהוגדרה עבורך הסתיימה.');
              return;
            }

            if (
              accessState.reason === 'missing_access_end' ||
              accessState.reason === 'invalid_access_end'
            ) {
              logoutNow('לא הוגדרה עבורך תקופת גישה תקינה.');
              return;
            }

            logoutNow('אין כרגע הרשאת גישה למערכת.');
            return;
          }

          clearExpiryTimeout();
          setCheckingAccess(false);

          if (data.role !== 'admin' && data.accessEndAt) {
            const endMs = new Date(data.accessEndAt).getTime();
            const delay = endMs - Date.now();

            if (Number.isNaN(endMs) || delay <= 0) {
              logoutNow('תקופת הגישה שהוגדרה עבורך הסתיימה.');
              return;
            }

            expiryTimeout = setTimeout(() => {
              logoutNow('תקופת הגישה שהוגדרה עבורך הסתיימה.');
            }, delay);
          }
        },
        (error) => {
          console.error('שגיאה במעקב אחרי הרשאת גישה:', error);
          setCheckingAccess(false);
        }
      );
    });

    return () => {
      clearExpiryTimeout();
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  return { checkingAccess };
}