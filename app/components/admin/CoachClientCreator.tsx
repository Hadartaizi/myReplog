import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../../../database/firebase";
import type { ClientInviteDoc } from "../../types/clientInvite";

type Props = {
  onAfterCreate?: () => void;
};

function toIsoDateTimeLocal(value: string, fallbackHour = "09:00") {
  if (!value?.trim()) return null;

  const normalized = value.includes("T") ? value : `${value}T${fallbackHour}`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

export default function CoachClientCreator({ onAfterCreate }: Props) {
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 1 &&
      email.trim().includes("@") &&
      startDate.trim().length > 0 &&
      endDate.trim().length > 0
    );
  }, [name, email, startDate, endDate]);

  const handleCreateInvite = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      showMessage("שגיאה", "לא נמצא משתמש מחובר");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const accessStartAt = toIsoDateTimeLocal(startDate, "09:00");
    const accessEndAt = toIsoDateTimeLocal(endDate, "23:59");

    if (!name.trim()) {
      showMessage("שגיאה", "יש להזין שם לקוח");
      return;
    }

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      showMessage("שגיאה", "יש להזין אימייל תקין");
      return;
    }

    if (!accessStartAt || !accessEndAt) {
      showMessage("שגיאה", "יש להזין תאריכי גישה תקינים");
      return;
    }

    if (new Date(accessStartAt).getTime() >= new Date(accessEndAt).getTime()) {
      showMessage("שגיאה", "תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
      return;
    }

    try {
      setSaving(true);

      const existingInviteQuery = query(
        collection(db, "clientInvites"),
        where("email", "==", normalizedEmail),
        where("inviteStatus", "==", "pending")
      );

      const existingInviteSnap = await getDocs(existingInviteQuery);

      if (!existingInviteSnap.empty) {
        showMessage(
          "כבר קיימת הזמנה",
          "יש כבר הזמנה פעילה ללקוח עם האימייל הזה. הלקוח יכול להשלים הרשמה."
        );
        return;
      }

      const inviteDoc: ClientInviteDoc = {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        role: "client",
        approvalStatus: "approved",
        accessStartAt,
        accessEndAt,
        createdByUid: currentUser.uid,
        inviteStatus: "pending",
        hasLoginAccount: false,
        authUid: null,
        cardsPurchased: 0,
        cardsUsed: 0,
        cardUsageDates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "clientInvites"), inviteDoc);

      setName("");
      setEmail("");
      setPhone("");
      setStartDate("");
      setEndDate("");

      onAfterCreate?.();

      showMessage(
        "הלקוח נוסף בהצלחה",
        "נוצרה הזמנה ללקוח. כעת הלקוח צריך להירשם עם אותו האימייל כדי להשלים את פתיחת החשבון."
      );
    } catch (error) {
      console.error("שגיאה ביצירת הזמנת לקוח:", error);
      showMessage("שגיאה", "לא ניתן ליצור הזמנה ללקוח");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>הוספת לקוח</Text>
      <Text style={styles.subtitle}>
        המאמן יוצר הזמנה, והלקוח משלים הרשמה בעצמו עם האימייל שלו
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="שם מלא"
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="אימייל"
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="טלפון"
        placeholderTextColor="#94A3B8"
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        value={startDate}
        onChangeText={setStartDate}
        placeholder="תאריך התחלה YYYY-MM-DD"
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />

      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder="תאריך סיום YYYY-MM-DD"
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />

      <Pressable
        onPress={handleCreateInvite}
        disabled={!canSubmit || saving}
        style={({ pressed }) => [
          styles.primaryButton,
          (!canSubmit || saving) && styles.disabledButton,
          pressed && canSubmit && !saving && styles.pressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? "שומר..." : "יצירת הזמנה ללקוח"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  title: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    color: "#0F172A",
    textAlign: "right",
    writingDirection: "rtl",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});