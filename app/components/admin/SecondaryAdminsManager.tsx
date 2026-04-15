import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../database/firebase";
import { formatDateTimeIL, getRemainingTimeLabel } from "./accessUtils";
import type { UserRole } from "../../types/user";

type Props = {
  onAfterUpdate?: () => void;
};

type SecondaryAdminItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  approvalStatus?: "pending" | "approved" | "blocked";
  accessStartAt?: string | null;
  accessEndAt?: string | null;
  createdByOwnerUid?: string | null;
  isSecondaryAdmin?: boolean;
};

type UserSearchItem = {
  id: string;
  name?: string;
  email?: string;
  role?: UserRole;
};

function formatDateInput(value: Date | null) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateString(value: string) {
  if (!value?.trim()) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function toIsoDateTimeFromDate(value: Date | null, hour = 9, minute = 0) {
  if (!value) return null;

  const localDate = new Date(value);
  localDate.setHours(hour, minute, 0, 0);

  if (Number.isNaN(localDate.getTime())) return null;
  return localDate.toISOString();
}

export default function SecondaryAdminsManager({ onAfterUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [emailSearch, setEmailSearch] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [secondaryAdmins, setSecondaryAdmins] = useState<SecondaryAdminItem[]>([]);
  const [allUsersForSearch, setAllUsersForSearch] = useState<UserSearchItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const ownerUid = auth.currentUser?.uid || "";

  const fetchSecondaryAdmins = async () => {
    if (!ownerUid) return;

    try {
      const adminsQuery = query(
        collection(db, "users"),
        where("role", "==", "admin"),
        where("createdByOwnerUid", "==", ownerUid)
      );

      const snap = await getDocs(adminsQuery);

      const list: SecondaryAdminItem[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SecondaryAdminItem, "id">),
      }));

      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
      setSecondaryAdmins(list);
    } catch (error) {
      console.error("שגיאה בטעינת מאמנים משניים:", error);
    }
  };

  const fetchUsersForEmailSuggestions = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));

      const usersList: UserSearchItem[] = usersSnap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<UserSearchItem, "id">),
        }))
        .filter((user) => !!user.email?.trim())
        .filter((user) => user.role !== "owner");

      usersList.sort((a, b) => (a.email || "").localeCompare(b.email || "", "he"));

      setAllUsersForSearch(usersList);
    } catch (error) {
      console.error("שגיאה בטעינת משתמשים לחיפוש:", error);
    }
  };

  useEffect(() => {
    fetchSecondaryAdmins();
    fetchUsersForEmailSuggestions();
  }, [ownerUid]);

  const canSubmit = useMemo(() => {
    return !!(emailSearch.trim() && startDate && endDate);
  }, [emailSearch, startDate, endDate]);

  const filteredSuggestions = useMemo(() => {
    const normalizedSearch = emailSearch.trim().toLowerCase();

    if (!normalizedSearch) return [];

    return allUsersForSearch
      .filter((user) => user.email?.toLowerCase().includes(normalizedSearch))
      .slice(0, 6);
  }, [emailSearch, allUsersForSearch]);

  const shouldShowSuggestions =
    showSuggestions && !!emailSearch.trim() && filteredSuggestions.length > 0;

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const handleSelectSuggestion = (email: string) => {
    setEmailSearch(email);
    setShowSuggestions(false);
  };

  const handleStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowStartPicker(false);
    }

    if (event.type === "dismissed") return;
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowEndPicker(false);
    }

    if (event.type === "dismissed") return;
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const promoteUserToSecondaryAdmin = async () => {
    if (!ownerUid) {
      showMessage("שגיאה", "לא נמצא משתמש מחובר");
      return;
    }

    const email = emailSearch.trim().toLowerCase();
    const accessStartAt = toIsoDateTimeFromDate(startDate, 9, 0);
    const accessEndAt = toIsoDateTimeFromDate(endDate, 23, 59);

    if (!email || !accessStartAt || !accessEndAt) {
      showMessage("שגיאה", "יש למלא אימייל, תאריך התחלה ותאריך סיום תקינים");
      return;
    }

    if (new Date(accessStartAt).getTime() >= new Date(accessEndAt).getTime()) {
      showMessage("שגיאה", "תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
      return;
    }

    try {
      setLoading(true);

      const userQuery = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(userQuery);

      if (snap.empty) {
        showMessage(
          "לא נמצא משתמש",
          "כדי להגדיר מאמן משני, קודם עליו להירשם למערכת עם האימייל הזה."
        );
        return;
      }

      const targetDoc = snap.docs[0];
      const targetData = targetDoc.data() as SecondaryAdminItem;

      if (targetData.role === "owner") {
        showMessage("שגיאה", "אי אפשר לשנות בעלת מערכת למאמן משני");
        return;
      }

      await updateDoc(doc(db, "users", targetDoc.id), {
        role: "admin",
        isSecondaryAdmin: true,
        createdByOwnerUid: ownerUid,
        approvalStatus: "approved",
        accessStartAt,
        accessEndAt,
        updatedAt: new Date().toISOString(),
      });

      setEmailSearch("");
      setStartDate(null);
      setEndDate(null);
      setShowSuggestions(false);

      await fetchSecondaryAdmins();
      await fetchUsersForEmailSuggestions();
      onAfterUpdate?.();

      showMessage("הצלחה", "המאמן הוגדר כמאמן משני בהצלחה");
    } catch (error) {
      console.error("שגיאה בהגדרת מאמן משני:", error);
      showMessage("שגיאה", "לא ניתן להגדיר מאמן משני");
    } finally {
      setLoading(false);
    }
  };

  const removeSecondaryAdmin = async (adminId: string) => {
    try {
      setLoading(true);

      await updateDoc(doc(db, "users", adminId), {
        role: "client",
        isSecondaryAdmin: false,
        createdByOwnerUid: null,
        accessStartAt: null,
        accessEndAt: null,
        approvalStatus: "blocked",
        updatedAt: new Date().toISOString(),
      });

      await fetchSecondaryAdmins();
      await fetchUsersForEmailSuggestions();
      onAfterUpdate?.();

      showMessage("הצלחה", "המאמן הוסר מהניהול");
    } catch (error) {
      console.error("שגיאה בהסרת מאמן משני:", error);
      showMessage("שגיאה", "לא ניתן להסיר את המאמן");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>הגדרת מאמן משני</Text>
        <Text style={styles.subtitle}>
          המאמן חייב להיות כבר רשום במערכת עם האימייל שלו
        </Text>

        <View style={styles.searchFieldWrapper}>
          <TextInput
            value={emailSearch}
            onChangeText={(text) => {
              setEmailSearch(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="אימייל של המאמן"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholderTextColor="#94A3B8"
          />

          {shouldShowSuggestions && (
            <View style={styles.suggestionsBox}>
              {filteredSuggestions.map((user, index) => (
                <Pressable
                  key={user.id}
                  onPress={() => handleSelectSuggestion(user.email || "")}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    index === filteredSuggestions.length - 1 && styles.lastSuggestionItem,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.suggestionTextWrap}>
                    {!!user.name?.trim() && (
                      <Text style={styles.suggestionName}>{user.name}</Text>
                    )}
                    <Text style={styles.suggestionEmail}>{user.email}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {Platform.OS === "web" ? (
          <>
            <View style={styles.dateFieldWrapper}>
              <Text style={styles.dateLabel}>תאריך התחלה</Text>
              <View style={styles.webDateInputBox}>
                <input
                  type="date"
                  value={formatDateInput(startDate)}
                  onChange={(e) => {
                    const nextDate = parseDateString(e.target.value);
                    setStartDate(nextDate);
                  }}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "#0F172A",
                    fontSize: 14,
                    direction: "rtl",
                    fontFamily: "inherit",
                  }}
                />
              </View>
            </View>

            <View style={styles.dateFieldWrapper}>
              <Text style={styles.dateLabel}>תאריך סיום</Text>
              <View style={styles.webDateInputBox}>
                <input
                  type="date"
                  value={formatDateInput(endDate)}
                  onChange={(e) => {
                    const nextDate = parseDateString(e.target.value);
                    setEndDate(nextDate);
                  }}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "#0F172A",
                    fontSize: 14,
                    direction: "rtl",
                    fontFamily: "inherit",
                  }}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setShowStartPicker(true)}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  !startDate && styles.datePlaceholder,
                ]}
              >
                {startDate
                  ? `תאריך התחלה: ${formatDateInput(startDate)}`
                  : "בחרי תאריך התחלה"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowEndPicker(true)}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  !endDate && styles.datePlaceholder,
                ]}
              >
                {endDate
                  ? `תאריך סיום: ${formatDateInput(endDate)}`
                  : "בחרי תאריך סיום"}
              </Text>
            </Pressable>
          </>
        )}

        {Platform.OS !== "web" && showStartPicker && (
          <DateTimePicker
            value={startDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleStartDateChange}
          />
        )}

        {Platform.OS !== "web" && showEndPicker && (
          <DateTimePicker
            value={endDate || startDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleEndDateChange}
          />
        )}

        <Pressable
          onPress={promoteUserToSecondaryAdmin}
          disabled={!canSubmit || loading}
          style={({ pressed }) => [
            styles.primaryButton,
            (!canSubmit || loading) && styles.disabledButton,
            pressed && canSubmit && !loading && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "שומר..." : "הגדר כמאמן משני"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>מאמנים משניים קיימים</Text>

        {secondaryAdmins.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>עדיין לא הוגדרו מאמנים משניים</Text>
          </View>
        ) : (
          secondaryAdmins.map((admin) => {
            const targetUid = admin.uid || admin.id;

            return (
              <View key={admin.id} style={styles.userRow}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{admin.name || "ללא שם"}</Text>
                  <Text style={styles.userEmail}>{admin.email || "ללא אימייל"}</Text>
                  <Text style={styles.userMeta}>
                    תחילת גישה: {formatDateTimeIL(admin.accessStartAt)}
                  </Text>
                  <Text style={styles.userMeta}>
                    סיום גישה: {formatDateTimeIL(admin.accessEndAt)}
                  </Text>
                  <Text style={styles.userMeta}>
                    זמן נותר: {getRemainingTimeLabel(admin.accessEndAt)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => removeSecondaryAdmin(targetUid)}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.deleteButtonText}>הסר מניהול</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "right",
    lineHeight: 20,
  },
  searchFieldWrapper: {
    width: "100%",
    position: "relative",
    zIndex: 20,
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
  suggestionsBox: {
    marginTop: 6,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
  },
  suggestionItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  lastSuggestionItem: {
    borderBottomWidth: 0,
  },
  suggestionTextWrap: {
    alignItems: "flex-end",
    gap: 3,
  },
  suggestionName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  suggestionEmail: {
    color: "#475569",
    fontSize: 13,
    textAlign: "right",
  },
  dateFieldWrapper: {
    width: "100%",
    gap: 6,
  },
  dateLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  webDateInputBox: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  dateButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  dateButtonText: {
    color: "#0F172A",
    fontSize: 14,
    textAlign: "right",
  },
  datePlaceholder: {
    color: "#94A3B8",
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
  emptyBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  userRow: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  userInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  userName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  userEmail: {
    color: "#475569",
    fontSize: 13,
    textAlign: "right",
  },
  userMeta: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "right",
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});