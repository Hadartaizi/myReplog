import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../database/firebase";
import type { UserRole } from "../../types/user";

type ClientItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  createdByUid?: string | null;
};

type ClientCardData = {
  cardsPurchased?: number;
  cardsUsed?: number;
  cardUsageDates?: string[];
};

type Props = {
  clients?: ClientItem[];
  onAfterUpdate?: () => void | Promise<void>;
};

function CardsIcon({ size = 18, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="6" width="12" height="9" rx="2" stroke={color} strokeWidth={2} fill="none" />
      <Rect x="8" y="9" width="12" height="9" rx="2" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="10" y1="12" x2="18" y2="12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function TrashIcon({ size = 18, color = "#DC2626" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth={2} />
      <Rect x="6" y="7" width="12" height="13" rx="1.5" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth={2} />
      <Line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth={2} />
      <Line x1="9" y1="5" x2="15" y2="5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusUserIcon({ size = 18, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="3" width="18" height="18" rx="4" stroke={color} strokeWidth={1.8} fill="none" />
      <Line x1="12" y1="8" x2="12" y2="14" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="9" y1="11" x2="15" y2="11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="8" y1="17" x2="16" y2="17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronIcon({
  size = 16,
  color = "#334155",
  direction = "down",
}: {
  size?: number;
  color?: string;
  direction?: "down" | "up";
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {direction === "down" ? (
        <>
          <Line x1="6" y1="9" x2="12" y2="15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <Line x1="18" y1="9" x2="12" y2="15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Line x1="6" y1="15" x2="12" y2="9" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <Line x1="18" y1="15" x2="12" y2="9" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

function getDateFromAny(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value?.toDate && typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }

  if (typeof value === "object" && typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function formatDateTimeIL(value?: string | null) {
  const date = getDateFromAny(value);
  if (!date) return "אין תאריך";

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function buildDateFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date | null {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function NumberWheel({
  label,
  values,
  selectedValue,
  onSelect,
}: {
  label: string;
  values: number[];
  selectedValue: number;
  onSelect: (value: number) => void;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const ITEM_HEIGHT = 46;

  useEffect(() => {
    const index = values.findIndex((item) => item === selectedValue);
    if (index >= 0) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: true,
        });
      }, 80);

      return () => clearTimeout(timer);
    }
  }, [selectedValue, values]);

  return (
    <View style={styles.wheelWrap}>
      <Text style={styles.wheelLabel}>{label}</Text>

      <View style={styles.wheelOuter}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={styles.wheelScrollContent}
        >
          {values.map((value) => {
            const selected = value === selectedValue;
            return (
              <Pressable
                key={`${label}-${value}`}
                onPress={() => onSelect(value)}
                style={[styles.wheelItem, selected && styles.wheelItemSelected]}
              >
                <Text style={[styles.wheelItemText, selected && styles.wheelItemTextSelected]}>
                  {pad2(value)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function DateTimeWheelPickerModal({
  visible,
  onClose,
  onConfirm,
  initialDate,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
}) {
  const baseDate = initialDate && !Number.isNaN(initialDate.getTime()) ? initialDate : new Date();

  const [year, setYear] = useState(baseDate.getFullYear());
  const [month, setMonth] = useState(baseDate.getMonth() + 1);
  const [day, setDay] = useState(baseDate.getDate());
  const [hour, setHour] = useState(baseDate.getHours());
  const [minute, setMinute] = useState(baseDate.getMinutes() - (baseDate.getMinutes() % 5));

  useEffect(() => {
    if (visible) {
      const date = initialDate && !Number.isNaN(initialDate.getTime()) ? initialDate : new Date();
      setYear(date.getFullYear());
      setMonth(date.getMonth() + 1);
      setDay(date.getDate());
      setHour(date.getHours());
      setMinute(date.getMinutes() - (date.getMinutes() % 5));
    }
  }, [visible, initialDate]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list: number[] = [];
    for (let y = currentYear - 3; y <= currentYear + 3; y += 1) list.push(y);
    return list;
  }, []);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(() => {
    const total = getDaysInMonth(year, month);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [year, month]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  useEffect(() => {
    const maxDay = getDaysInMonth(year, month);
    if (day > maxDay) {
      setDay(maxDay);
    }
  }, [day, month, year]);

  const previewDate = buildDateFromParts(year, month, day, hour, minute);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>בחירת תאריך ושעה למימוש</Text>

          <Text style={styles.modalPreviewText}>
            {previewDate
              ? new Intl.DateTimeFormat("he-IL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(previewDate)
              : "תאריך לא תקין"}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wheelsRow}>
            <NumberWheel label="דקות" values={minutes} selectedValue={minute} onSelect={setMinute} />
            <NumberWheel label="שעה" values={hours} selectedValue={hour} onSelect={setHour} />
            <NumberWheel label="יום" values={days} selectedValue={day} onSelect={setDay} />
            <NumberWheel label="חודש" values={months} selectedValue={month} onSelect={setMonth} />
            <NumberWheel label="שנה" values={years} selectedValue={year} onSelect={setYear} />
          </ScrollView>

          <View style={styles.modalActionsRow}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.modalSecondaryButton, pressed && styles.pressed]}>
              <Text style={styles.modalSecondaryButtonText}>ביטול</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const result = buildDateFromParts(year, month, day, hour, minute);
                if (!result) {
                  Alert.alert("שגיאה", "התאריך או השעה אינם תקינים");
                  return;
                }
                onConfirm(result);
              }}
              style={({ pressed }) => [styles.modalPrimaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalPrimaryButtonText}>אישור</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ClientCardManager({
  clients: initialClients = [],
  onAfterUpdate,
}: Props) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  const dynamic = useMemo(() => {
    return {
      titleSize: isSmallScreen ? 18 : isTablet ? 22 : 20,
      textSize: isSmallScreen ? 13 : 14,
      subTextSize: isSmallScreen ? 12 : 13,
      cardPadding: isSmallScreen ? 14 : 16,
    };
  }, [isSmallScreen, isTablet]);

  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [loadingClients, setLoadingClients] = useState(initialClients.length === 0);
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [redeemingCard, setRedeemingCard] = useState(false);
  const [deletingRedeemIndex, setDeletingRedeemIndex] = useState<number | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);

  const [cardsPurchasedInput, setCardsPurchasedInput] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [searchQueryText, setSearchQueryText] = useState("");
  const [searchTouched, setSearchTouched] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [manualSectionOpen, setManualSectionOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedRedeemDate, setSelectedRedeemDate] = useState<Date | null>(new Date());

  const [cardData, setCardData] = useState<ClientCardData>({
    cardsPurchased: 0,
    cardsUsed: 0,
    cardUsageDates: [],
  });

  const loadClients = useCallback(async () => {
    if (initialClients.length > 0) {
      setClients(initialClients);
      setSelectedClient((prev) => {
        if (!prev) return null;

        const matched = initialClients.find(
          (item) => (item.uid || item.id) === (prev.uid || prev.id)
        );

        return matched || null;
      });
      setLoadingClients(false);
      return;
    }

    try {
      setLoadingClients(true);

      const me = auth.currentUser;
      if (!me?.uid) {
        setClients([]);
        setSelectedClient(null);
        setLoadingClients(false);
        return;
      }

      const myUserSnap = await getDoc(doc(db, "users", me.uid));
      const myUser = myUserSnap.data();

      let q;

      if (myUser?.role === "owner") {
        q = query(collection(db, "users"), where("role", "==", "client"));
      } else if (myUser?.role === "admin") {
        q = query(
          collection(db, "users"),
          where("role", "==", "client"),
          where("createdByUid", "==", me.uid)
        );
      } else {
        setClients([]);
        setSelectedClient(null);
        setLoadingClients(false);
        return;
      }

      const snap = await getDocs(q);

      const list: ClientItem[] = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientItem, "id">),
        }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));

      setClients(list);
      setSelectedClient((prev) => {
        if (!prev) return null;

        const matched = list.find(
          (item) => (item.uid || item.id) === (prev.uid || prev.id)
        );

        return matched || null;
      });
    } catch (error) {
      console.error("שגיאה בטעינת לקוחות:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את רשימת הלקוחות");
    } finally {
      setLoadingClients(false);
    }
  }, [initialClients]);

  const loadClientCardData = useCallback(async (client: ClientItem | null) => {
    if (!client) {
      setCardData({
        cardsPurchased: 0,
        cardsUsed: 0,
        cardUsageDates: [],
      });
      setCardsPurchasedInput("");
      return;
    }

    try {
      setLoadingData(true);

      const targetUid = client.uid || client.id;
      const userRef = doc(db, "users", targetUid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setCardData({
          cardsPurchased: 0,
          cardsUsed: 0,
          cardUsageDates: [],
        });
        setCardsPurchasedInput("0");
        return;
      }

      const data = userSnap.data() as ClientCardData;

      const cardsPurchased = Number(data.cardsPurchased || 0);
      const cardUsageDates = Array.isArray(data.cardUsageDates)
        ? [...data.cardUsageDates].sort(
            (a, b) =>
              (getDateFromAny(b)?.getTime() || 0) - (getDateFromAny(a)?.getTime() || 0)
          )
        : [];

      setCardData({
        cardsPurchased,
        cardsUsed: cardUsageDates.length,
        cardUsageDates,
      });

      setCardsPurchasedInput(String(cardsPurchased));
    } catch (error) {
      console.error("שגיאה בטעינת נתוני כרטיסיות:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את נתוני הכרטיסיות");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    loadClientCardData(selectedClient);
  }, [selectedClient, loadClientCardData]);

  const purchased = Number(cardData.cardsPurchased || 0);
  const usageDates = Array.isArray(cardData.cardUsageDates) ? cardData.cardUsageDates : [];
  const used = usageDates.length;
  const remaining = Math.max(purchased - used, 0);

  const normalizedSearch = searchQueryText.trim().toLowerCase();

  const searchedClients = useMemo(() => {
    if (!normalizedSearch) return [];

    return clients.filter((client) => {
      const name = (client.name || "").trim().toLowerCase();
      return name.includes(normalizedSearch);
    });
  }, [clients, normalizedSearch]);

  const createManualClient = async () => {
    const cleanName = manualName.trim();
    const cleanEmail = manualEmail.trim().toLowerCase();

    if (!cleanName) {
      Alert.alert("שגיאה", "יש להזין שם לקוח");
      return;
    }

    const duplicateClient = clients.find((client) => {
      const sameName = (client.name || "").trim() === cleanName;
      const sameEmail =
        cleanEmail &&
        (client.email || "").trim().toLowerCase() === cleanEmail;

      return sameName || sameEmail;
    });

    if (duplicateClient) {
      Alert.alert("שגיאה", "קיים כבר לקוח דומה ברשימה");
      return;
    }

    try {
      setCreatingClient(true);

      const me = auth.currentUser;

      const payload = {
        name: cleanName,
        email: cleanEmail || "",
        role: "client" as const,
        createdByUid: me?.uid || null,
        approvalStatus: "approved" as const,
        accessStartAt: new Date().toISOString(),
        accessEndAt: null,
        hasLoginAccount: false,
        authUid: null,
        cardsPurchased: 0,
        cardsUsed: 0,
        cardUsageDates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "users"), payload);

      const newClient: ClientItem = {
        id: docRef.id,
        uid: docRef.id,
        name: cleanName,
        email: cleanEmail || "",
        role: "client",
        createdByUid: me?.uid || null,
      };

      setClients((prev) =>
        [...prev, newClient].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "he")
        )
      );

      setSelectedClient(newClient);
      setSearchQueryText(cleanName);
      setSearchTouched(true);
      setSearchFocused(false);
      setManualName("");
      setManualEmail("");
      setManualSectionOpen(false);

      setCardData({
        cardsPurchased: 0,
        cardsUsed: 0,
        cardUsageDates: [],
      });
      setCardsPurchasedInput("0");

      if (Platform.OS === "web") {
        window.alert("הלקוח נוסף בהצלחה");
      } else {
        Alert.alert("הצלחה", "הלקוח נוסף בהצלחה");
      }

      await onAfterUpdate?.();
    } catch (error) {
      console.error("שגיאה ביצירת לקוח ידנית:", error);
      Alert.alert("שגיאה", "לא ניתן ליצור לקוח ידנית");
    } finally {
      setCreatingClient(false);
    }
  };

  const savePurchasedCards = async () => {
    if (!selectedClient || savingCards) return;

    const parsedValue = Number(cardsPurchasedInput);

    if (!Number.isFinite(parsedValue) || parsedValue < 0 || !Number.isInteger(parsedValue)) {
      Alert.alert("שגיאה", "יש להזין מספר כרטיסיות תקין");
      return;
    }

    if (parsedValue < used) {
      Alert.alert("שגיאה", "לא ניתן להגדיר פחות כרטיסיות ממספר הכרטיסיות שכבר מומשו");
      return;
    }

    try {
      setSavingCards(true);

      const targetUid = selectedClient.uid || selectedClient.id;
      await updateDoc(doc(db, "users", targetUid), {
        cardsPurchased: parsedValue,
        cardsUsed: used,
        updatedAt: new Date().toISOString(),
      });

      setCardData((prev) => ({
        ...prev,
        cardsPurchased: parsedValue,
        cardsUsed: used,
      }));

      if (Platform.OS === "web") {
        window.alert("מספר הכרטיסיות עודכן");
      } else {
        Alert.alert("הצלחה", "מספר הכרטיסיות עודכן");
      }

      await onAfterUpdate?.();
    } catch (error) {
      console.error("שגיאה בעדכון כרטיסיות:", error);
      Alert.alert("שגיאה", "לא ניתן לעדכן את מספר הכרטיסיות");
    } finally {
      setSavingCards(false);
    }
  };

  const redeemCardAtDate = async (date: Date) => {
    if (!selectedClient || redeemingCard) return;

    if (remaining <= 0) {
      Alert.alert("אין כרטיסיות", "לא נותרו כרטיסיות למימוש עבור הלקוח");
      return;
    }

    if (Number.isNaN(date.getTime())) {
      Alert.alert("שגיאה", "תאריך המימוש אינו תקין");
      return;
    }

    try {
      setRedeemingCard(true);

      const targetUid = selectedClient.uid || selectedClient.id;
      const redeemIso = date.toISOString();
      const nextUsageDates = [redeemIso, ...usageDates].sort(
        (a, b) =>
          (getDateFromAny(b)?.getTime() || 0) - (getDateFromAny(a)?.getTime() || 0)
      );

      await updateDoc(doc(db, "users", targetUid), {
        cardUsageDates: nextUsageDates,
        cardsUsed: nextUsageDates.length,
        updatedAt: new Date().toISOString(),
      });

      setCardData((prev) => ({
        cardsPurchased: Number(prev.cardsPurchased || 0),
        cardsUsed: nextUsageDates.length,
        cardUsageDates: nextUsageDates,
      }));

      if (Platform.OS === "web") {
        window.alert("בוצע מימוש כרטיסייה");
      } else {
        Alert.alert("הצלחה", "בוצע מימוש כרטיסייה");
      }

      await onAfterUpdate?.();
    } catch (error) {
      console.error("שגיאה במימוש כרטיסייה:", error);
      Alert.alert("שגיאה", "לא ניתן לממש כרטיסייה");
    } finally {
      setRedeemingCard(false);
    }
  };

  const deleteRedeem = async (indexToDelete: number) => {
    if (!selectedClient) return;

    const confirmed =
      Platform.OS === "web"
        ? window.confirm("האם למחוק את המימוש הזה?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert("מחיקת מימוש", "האם למחוק את המימוש הזה?", [
              { text: "ביטול", style: "cancel", onPress: () => resolve(false) },
              { text: "מחק", style: "destructive", onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    try {
      setDeletingRedeemIndex(indexToDelete);

      const targetUid = selectedClient.uid || selectedClient.id;
      const nextUsageDates = usageDates.filter((_, index) => index !== indexToDelete);

      await updateDoc(doc(db, "users", targetUid), {
        cardUsageDates: nextUsageDates,
        cardsUsed: nextUsageDates.length,
        updatedAt: new Date().toISOString(),
      });

      setCardData((prev) => ({
        cardsPurchased: Number(prev.cardsPurchased || 0),
        cardsUsed: nextUsageDates.length,
        cardUsageDates: nextUsageDates,
      }));

      if (Platform.OS === "web") {
        window.alert("המימוש נמחק");
      } else {
        Alert.alert("הצלחה", "המימוש נמחק");
      }

      await onAfterUpdate?.();
    } catch (error) {
      console.error("שגיאה במחיקת מימוש:", error);
      Alert.alert("שגיאה", "לא ניתן למחוק את המימוש");
    } finally {
      setDeletingRedeemIndex(null);
    }
  };

  if (loadingClients) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#0F172A" />
        <Text style={styles.loadingText}>טוען רשימת לקוחות...</Text>
      </View>
    );
  }

  const showSearchResults = searchFocused && normalizedSearch.length > 0;

  return (
    <View style={styles.container}>
      <DateTimeWheelPickerModal
        visible={pickerVisible}
        initialDate={selectedRedeemDate || new Date()}
        onClose={() => setPickerVisible(false)}
        onConfirm={(date) => {
          setSelectedRedeemDate(date);
          setPickerVisible(false);
        }}
      />

      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <CardsIcon size={18} color="#0F172A" />
          <Text style={[styles.headerTitle, { fontSize: dynamic.titleSize }]}>
            מימוש כרטיסייה
          </Text>
        </View>

        <Text style={[styles.headerSubtitle, { fontSize: dynamic.subTextSize }]}>
          חיפוש לקוח לפי שם, הגדרת כרטיסיות, ומימוש ידני לפי תאריך ושעה בגלילה
        </Text>
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={() => setManualSectionOpen((prev) => !prev)}
          style={({ pressed }) => [
            styles.expandButton,
            manualSectionOpen && styles.expandButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.expandButtonRight}>
            <PlusUserIcon size={18} color="#0F172A" />
            <Text style={styles.expandButtonText}>הוספה ידנית</Text>
          </View>

          <ChevronIcon direction={manualSectionOpen ? "up" : "down"} />
        </Pressable>

        {manualSectionOpen && (
          <View style={styles.expandContent}>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="שם הלקוח"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              textAlign="right"
            />

            <TextInput
              value={manualEmail}
              onChangeText={setManualEmail}
              placeholder="אימייל הלקוח (לא חובה)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              textAlign="right"
            />

            <Pressable
              onPress={createManualClient}
              disabled={creatingClient}
              style={({ pressed }) => [
                styles.primaryActionButton,
                pressed && styles.pressed,
                creatingClient && styles.disabledButton,
              ]}
            >
              {creatingClient ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryActionButtonText}>הוסף לקוח</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>חיפוש לקוח עם כרטיסייה</Text>

        <TextInput
          value={searchQueryText}
          onChangeText={(text) => {
            setSearchTouched(true);
            setSearchFocused(true);
            setSearchQueryText(text);

            const exactMatch = clients.find(
              (client) => (client.name || "").trim() === text.trim()
            );

            if (!text.trim()) {
              setSelectedClient(null);
              return;
            }

            if (exactMatch) {
              setSelectedClient(exactMatch);
              setSearchFocused(false);
            } else {
              setSelectedClient(null);
            }
          }}
          onFocus={() => setSearchFocused(true)}
          placeholder="הקלידי שם לקוחה"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          textAlign="right"
        />

        {!normalizedSearch ? (
          <View style={styles.searchHintBox}>
            <Text style={styles.searchHintText}>התחילי להקליד שם כדי לבחור לקוח</Text>
          </View>
        ) : searchedClients.length === 0 ? (
          <Text style={styles.searchNotFoundText}>לא נמצאה לקוחה בשם הזה</Text>
        ) : showSearchResults ? (
          <View style={styles.searchResultsList}>
            {searchedClients.map((client) => {
              const isSelected =
                (selectedClient?.uid || selectedClient?.id) === (client.uid || client.id);

              return (
                <Pressable
                  key={client.id}
                  onPress={() => {
                    setSelectedClient(client);
                    setSearchQueryText(client.name || "");
                    setSearchTouched(true);
                    setSearchFocused(false);
                  }}
                  style={({ pressed }) => [
                    styles.searchResultCard,
                    isSelected && styles.searchResultCardActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.searchResultTextWrap}>
                    <Text style={[styles.searchResultName, isSelected && styles.searchResultNameActive]}>
                      {client.name || "ללא שם"}
                    </Text>
                    <Text style={[styles.searchResultEmail, isSelected && styles.searchResultEmailActive]}>
                      {client.email || "ללא אימייל"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {selectedClient ? (
        loadingData ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={styles.loadingText}>טוען נתוני כרטיסיות...</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                <Text style={styles.summaryValue}>{purchased}</Text>
                <Text style={styles.summaryLabel}>נרכשו</Text>
              </View>

              <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                <Text style={styles.summaryValue}>{used}</Text>
                <Text style={styles.summaryLabel}>מומשו</Text>
              </View>

              <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                <Text style={styles.summaryValue}>{remaining}</Text>
                <Text style={styles.summaryLabel}>נותרו</Text>
              </View>

              <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                <Text style={styles.summaryValue}>
                  {purchased > 0 ? "יש" : "אין"}
                </Text>
                <Text style={styles.summaryLabel}>כרטיסייה</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>הגדרת מספר כרטיסיות</Text>

              <TextInput
                value={cardsPurchasedInput}
                onChangeText={(text) => setCardsPurchasedInput(text.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="הזיני מספר כרטיסיות"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                textAlign="right"
              />

              <Pressable
                onPress={savePurchasedCards}
                disabled={savingCards}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  pressed && styles.pressed,
                  savingCards && styles.disabledButton,
                ]}
              >
                {savingCards ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionButtonText}>שמור מספר כרטיסיות</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>מימוש כרטיסייה באופן ידני</Text>

              <Pressable
                onPress={() => setPickerVisible(true)}
                style={({ pressed }) => [
                  styles.datePickerOpenButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.datePickerOpenButtonText}>
                  {selectedRedeemDate
                    ? `נבחר: ${new Intl.DateTimeFormat("he-IL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(selectedRedeemDate)}`
                    : "בחרי תאריך ושעה"}
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  if (!selectedRedeemDate) {
                    Alert.alert("שגיאה", "יש לבחור תאריך ושעה");
                    return;
                  }
                  await redeemCardAtDate(selectedRedeemDate);
                }}
                disabled={redeemingCard || remaining <= 0}
                style={({ pressed }) => [
                  styles.redeemManualButton,
                  pressed && styles.pressed,
                  (redeemingCard || remaining <= 0) && styles.disabledButton,
                ]}
              >
                {redeemingCard ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.redeemButtonText}>ממש כרטיסייה</Text>
                )}
              </Pressable>

              <Text style={styles.remainingText}>
                {purchased <= 0
                  ? "ללקוח הזה אין כרטיסייה"
                  : `כרטיסיות זמינות למימוש: ${remaining}`}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>תאריכי מימוש</Text>

              {usageDates.length === 0 ? (
                <View style={styles.emptyInnerBox}>
                  <Text style={styles.emptyText}>עדיין לא בוצעו מימושים</Text>
                </View>
              ) : (
                <View style={styles.usageList}>
                  {usageDates.map((usageDate, index) => (
                    <View key={`${usageDate}-${index}`} style={styles.usageRow}>
                      <View style={styles.usageDeleteWrap}>
                        <Pressable
                          onPress={() => deleteRedeem(index)}
                          disabled={deletingRedeemIndex === index}
                          style={({ pressed }) => [
                            styles.deleteUsageButton,
                            pressed && styles.pressed,
                            deletingRedeemIndex === index && styles.disabledButton,
                          ]}
                        >
                          {deletingRedeemIndex === index ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <TrashIcon size={18} color="#DC2626" />
                          )}
                        </Pressable>
                      </View>

                      <View style={styles.usageInfo}>
                        <Text style={styles.usageDateText}>מימוש {usageDates.length - index}</Text>
                        <Text style={styles.usageDateText}>{formatDateTimeIL(usageDate)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>בחרי לקוח כדי להציג את נתוני הכרטיסייה</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },

  topHeader: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },

  headerTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  headerTitle: {
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "center",
  },

  headerSubtitle: {
    marginTop: 8,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
  },

  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },

  expandButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  expandButtonActive: {
    borderColor: "#94A3B8",
    backgroundColor: "#F1F5F9",
  },

  expandButtonRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },

  expandButtonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },

  expandContent: {
    gap: 12,
    paddingTop: 4,
  },

  input: {
    width: "100%",
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    color: "#0F172A",
    fontSize: 15,
    textAlign: "right",
  },

  primaryActionButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  primaryActionButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },

  searchHintBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },

  searchHintText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "right",
  },

  searchNotFoundText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "right",
    fontWeight: "600",
  },

  searchResultsList: {
    gap: 10,
  },

  searchResultCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },

  searchResultCardActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },

  searchResultTextWrap: {
    alignItems: "flex-end",
  },

  searchResultName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  searchResultNameActive: {
    color: "#1E293B",
  },

  searchResultEmail: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 13,
    textAlign: "right",
  },

  searchResultEmailActive: {
    color: "#475569",
  },

  summaryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 10,
    justifyContent: "flex-start",
  },

  summaryCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 95,
  },

  summaryValue: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  summaryLabel: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  datePickerOpenButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  datePickerOpenButtonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },

  redeemManualButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  redeemButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },

  remainingText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },

  usageList: {
    gap: 10,
  },

  usageRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  usageInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },

  usageDeleteWrap: {
    justifyContent: "center",
    alignItems: "center",
  },

  deleteUsageButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  usageDateText: {
    color: "#0F172A",
    fontSize: 13,
    textAlign: "right",
    flexShrink: 1,
  },

  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
  },

  emptyInnerBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },

  emptyText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },

  loadingBox: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.82,
  },

  disabledButton: {
    opacity: 0.6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  modalPreviewText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  wheelsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    paddingVertical: 4,
  },

  wheelWrap: {
    width: 72,
    alignItems: "center",
    gap: 8,
  },

  wheelLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  wheelOuter: {
    height: 220,
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    overflow: "hidden",
  },

  wheelScrollContent: {
    paddingVertical: 10,
  },

  wheelItem: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    borderRadius: 12,
  },

  wheelItemSelected: {
    backgroundColor: "#E2E8F0",
  },

  wheelItemText: {
    color: "#334155",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  wheelItemTextSelected: {
    color: "#0F172A",
    fontWeight: "800",
  },

  modalActionsRow: {
    flexDirection: "row-reverse",
    gap: 10,
  },

  modalPrimaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  modalSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  modalSecondaryButtonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
});