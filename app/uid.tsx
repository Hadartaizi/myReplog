import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../database/firebase';

type UserData = {
  name: string;
  level?: string;
  latestWeight?: number;
};

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const fetchUser = async () => {
      try {
        const ref = doc(db, 'users', uid.toString());
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setUserData(snap.data() as UserData);
        } else {
          setUserData(null);
        }
      } catch (error) {
        console.error('שגיאה בטעינת משתמש:', error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [uid]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 50 }} />;
  }

  if (!userData) {
    return (
      <View style={styles.center}>
        <Text>משתמש לא נמצא</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 פרופיל משתמש</Text>
      <Text style={styles.label}>שם: {userData.name}</Text>
      <Text style={styles.label}>רמת כושר: {userData.level ?? 'לא צוינה'}</Text>
      <Text style={styles.label}>משקל אחרון: {userData.latestWeight ?? '---'} ק"ג</Text>
      {/* הוסיפי כאן גרפים / סטטיסטיקות בעתיד */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 18, marginBottom: 10 },
});
