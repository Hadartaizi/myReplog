import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../database/firebase";
import type { ClientInviteDoc } from "../../types/clientInvite";
import type { UserRole } from "../../types/user";

type Props = {
  onAfterCreate?: () => void;
};

type CurrentUserData = {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  createdByOwnerUid?: string | null;
  authUid?: string | null;
  uid?: string | null;
};

type ResolvedUserDoc = {
  docId: string;
  data: CurrentUserData;
};

function toIsoDateTimeFromDate(date: Date | null, endOfDay = false) {
  if (!date) return null;

  const copy = new Date(date);

  if (endOfDay) {
    copy.setHours(23, 59, 0, 0);
  } else {
    copy.setHours(9, 0, 0, 0);
  }

  if (Number.isNaN(copy.getTime())) return null;
  return copy.toISOString();
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function formatDateToInputValue(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function resolveCurrentUserDoc(): Promise<ResolvedUserDoc | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const authUid = String(currentUser.uid || "").trim();
  const authEmail = normalizeEmail(currentUser.email);

  if (authUid) {
    const directSnap = await getDoc(doc(db, "users", authUid));
    if (directSnap.exists()) {
      return {
        docId: directSnap.id,
        data: directSnap.data() as CurrentUserData,
      };
    }
  }

  if (authUid) {
    const byUidSnap = await getDocs(
      query(collection(db, "users"), where("uid", "==", authUid))
    );

    if (!byUidSnap.empty) {
      const found = byUidSnap.docs[0];
      return {
        docId: found.id,
        data: found.data() as CurrentUserData,
      };
    }
  }

  if (authUid) {
    const byAuthUidSnap = await getDocs(
      query(collection(db, "users"), where("authUid", "==", authUid))
    );

    if (!byAuthUidSnap.empty) {
      const found = byAuthUidSnap.docs[0];
      return {
        docId: found.id,
        data: found.data() as CurrentUserData,
      };
    }
  }

  if (authEmail) {
    const byEmailSnap = await getDocs(
      query(collection(db, "users"), where("email", "==", authEmail))
    );

    if (!byEmailSnap.empty) {
      const found = byEmailSnap.docs[0];
      return {
        docId: found.id,
        data: found.data() as CurrentUserData,
      };
    }
  }

  return null;
}

export default function CoachClientCreator({ onAfterCreate }: Props) {
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 1 &&
      email.trim().includes("@") &&
      !!startDate &&
      !!endDate
    );
  }, [name, email, startDate, endDate]);

  const openWebDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (Platform.OS !== "web") return;
    const input = ref.current;
    if (!input) return;

    const inputWithShowPicker = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    input.focus();

    if (typeof inputWithShowPicker.showPicker === "function") {
      inputWithShowPicker.showPicker();
    } else {
      input.click();
    }
  };

  const handleCreateInvite = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      showMessage("שגיאה", "לא נמצא משתמש מחובר");
      return;
    }

    const resolvedUser = await resolveCurrentUserDoc();

    if (!resolvedUser) {
      showMessage("שגיאה", "לא נמצא מסמך משתמש");
      return;
    }

    const { docId: currentUserDocId, data: currentUserData } = resolvedUser;

    const normalizedEmail = normalizeEmail(email);
    const accessStartAt = toIsoDateTimeFromDate(startDate, false);
    const accessEndAt = toIsoDateTimeFromDate(endDate, true);

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

      const nowIso = new Date().toISOString();

      const inviteDoc: ClientInviteDoc & {
        createdByOwnerUid?: string | null;
      } = {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        role: "client",
        approvalStatus: "approved",
        accessStartAt,
        accessEndAt,
        createdByUid: currentUserDocId,
        createdByOwnerUid:
          currentUserData.role === "owner"
            ? currentUserDocId
            : currentUserData.createdByOwnerUid || null,
        inviteStatus: "pending",
        hasLoginAccount: false,
        authUid: null,
        cardsPurchased: 0,
        cardsUsed: 0,
        cardUsageDates: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await addDoc(collection(db, "clientInvites"), inviteDoc);

      setName("");
      setEmail("");
      setPhone("");
      setStartDate(null);
      setEndDate(null);

      onAfterCreate?.();

      showMessage(
        "הלקוח נוסף בהצלחה",
        "נוצרה הזמנה ללקוח. כעת הלקוח צריך להירשם עם אותו האימייל כדי להשלים את פתיחת החשבון."
      );
    } catch (error: any) {
      console.error("שגיאה ביצירת הזמנת לקוח:", error);

      const errorMessage =
        typeof error?.message === "string" ? error.message : "";

      if (
        errorMessage.includes("Missing or insufficient permissions") ||
        error?.code === "permission-denied"
      ) {
        showMessage(
          "שגיאת הרשאה",
          "אין הרשאה ליצור הזמנה ללקוח. צריך לעדכן את חוקי Firebase כדי לאפשר לבעלת מערכת או למאמן משני ליצור מסמך ב-clientInvites."
        );
        return;
      }

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
        placeholderTextColor="#7A7A7A"
        style={styles.input}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="אימייל"
        placeholderTextColor="#7A7A7A"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="טלפון"
        placeholderTextColor="#7A7A7A"
        keyboardType="phone-pad"
        style={styles.input}
      />

      {Platform.OS === "web" ? (
        <>
          <Pressable
            onPress={() => openWebDatePicker(startInputRef)}
            style={styles.dateField}
          >
            <Text style={[styles.dateFieldText, !startDate && styles.placeholderText]}>
              {startDate ? startDate.toLocaleDateString("he-IL") : "תאריך התחלה"}
            </Text>
            <input
              ref={startInputRef}
              type="date"
              value={formatDateToInputValue(startDate)}
              onChange={(e) => {
                const value = e.target.value;
                setStartDate(value ? new Date(`${value}T00:00:00`) : null);
              }}
              style={webHiddenInput}
            />
          </Pressable>

          <Pressable
            onPress={() => openWebDatePicker(endInputRef)}
            style={styles.dateField}
          >
            <Text style={[styles.dateFieldText, !endDate && styles.placeholderText]}>
              {endDate ? endDate.toLocaleDateString("he-IL") : "תאריך סיום"}
            </Text>
            <input
              ref={endInputRef}
              type="date"
              value={formatDateToInputValue(endDate)}
              onChange={(e) => {
                const value = e.target.value;
                setEndDate(value ? new Date(`${value}T00:00:00`) : null);
              }}
              style={webHiddenInput}
            />
          </Pressable>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => setShowStartPicker(true)}
            style={styles.dateField}
          >
            <Text style={[styles.dateFieldText, !startDate && styles.placeholderText]}>
              {startDate ? startDate.toLocaleDateString("he-IL") : "תאריך התחלה"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowEndPicker(true)}
            style={styles.dateField}
          >
            <Text style={[styles.dateFieldText, !endDate && styles.placeholderText]}>
              {endDate ? endDate.toLocaleDateString("he-IL") : "תאריך סיום"}
            </Text>
          </Pressable>

          {showStartPicker && (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display="default"
              onChange={(_, selectedDate) => {
                setShowStartPicker(false);
                if (selectedDate) {
                  setStartDate(selectedDate);
                }
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDate || startDate || new Date()}
              mode="date"
              display="default"
              onChange={(_, selectedDate) => {
                setShowEndPicker(false);
                if (selectedDate) {
                  setEndDate(selectedDate);
                }
              }}
            />
          )}
        </>
      )}

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
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  subtitle: {
    color: "#B8B8B8",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A3A3A",
    backgroundColor: "#1C1C1C",
    paddingHorizontal: 14,
    color: "#FFFFFF",
    textAlign: "right",
    writingDirection: "rtl",
  },
  dateField: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A3A3A",
    backgroundColor: "#1C1C1C",
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "flex-end",
    position: "relative",
    overflow: "hidden",
  },
  dateFieldText: {
    width: "100%",
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "right",
  },
  placeholderText: {
    color: "#7A7A7A",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#FF6A00",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#141414",
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

const webHiddenInput: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
};