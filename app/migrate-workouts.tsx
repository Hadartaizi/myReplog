import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { migrateOldWorkoutDataForAllUsers } from "./components/clientWorkout/migrateOldWorkoutData";

export default function MigrateWorkoutsScreen() {
  const [loading, setLoading] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  const handleMigrate = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setDoneMessage("");

      const result = await migrateOldWorkoutDataForAllUsers();

      const message = `ההמרה הושלמה. טופלו ${result.migratedCount} רשומות ישנות.`;
      setDoneMessage(message);
      Alert.alert("הצלחה", message);
    } catch (error) {
      console.error("Migration error:", error);
      Alert.alert("שגיאה", "אירעה שגיאה בזמן ההמרה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>המרת נתוני אימונים ישנים</Text>
        <Text style={styles.subtitle}>
          יש להפעיל פעם אחת בלבד כדי לתקן נתונים שנשמרו במבנה הישן
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
          onPress={handleMigrate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>הרץ המרה</Text>
          )}
        </Pressable>

        {!!doneMessage && <Text style={styles.doneText}>{doneMessage}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 28,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  doneText: {
    marginTop: 18,
    color: "#166534",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.65,
  },
});