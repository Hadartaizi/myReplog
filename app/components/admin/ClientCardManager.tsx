import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
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
import { db } from "../../../database/firebase";

type ClientItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: "admin" | "client";
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

function parseDateAndTime(dateInput: string, timeInput: string): Date | null {
  const dateRaw = String(dateInput || "").trim();
  const timeRaw = String(timeInput || "").trim();

  if (!dateRaw) return null;

  let day: number;
  let month: number;
  let year: number;

  const isoMatch = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ilMatch = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (ilMatch) {
    day = Number(ilMatch[1]);
    month = Number(ilMatch[2]);
    year = Number(ilMatch[3]);
  } else {
    return null;
  }

  let hours = 0;
  let minutes = 0;

  if (timeRaw) {
    const timeMatch = timeRaw.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) return null;

    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

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
      pillHeight: isSmallScreen ? 46 : 50,
      cardPadding: isSmallScreen ? 14 : 16,
    };
  }, [isSmallScreen, isTablet]);

  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [loadingClients, setLoadingClients] = useState(initialClients.length === 0);
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(
    initialClients[0] || null
  );
  const [loadingData, setLoadingData] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [redeemingCard, setRedeemingCard] = useState(false);
  const [deletingRedeemIndex, setDeletingRedeemIndex] = useState<number | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);

  const [cardsPurchasedInput, setCardsPurchasedInput] = useState("");
  const [redeemDateInput, setRedeemDateInput] = useState("");
  const [redeemTimeInput, setRedeemTimeInput] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  const [cardData, setCardData] = useState<ClientCardData>({
    cardsPurchased: 0,
    cardsUsed: 0,
    cardUsageDates: [],
  });

  const loadClients = useCallback(async () => {
    if (initialClients.length > 0) {
      setClients(initialClients);
      setSelectedClient((prev) => {
        if (!prev && initialClients[0]) return initialClients[0];

        if (!prev) return null;

        const matched = initialClients.find(
          (item) => (item.uid || item.id) === (prev.uid || prev.id)
        );

        return matched || initialClients[0] || null;
      });
      setLoadingClients(false);
      return;
    }

    try {
      setLoadingClients(true);

      const q = query(collection(db, "users"), where("role", "==", "client"));
      const snap = await getDocs(q);

      const list: ClientItem[] = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientItem, "id">),
        }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));

      setClients(list);
      setSelectedClient((prev) => {
        if (!prev) return list[0] || null;

        const matched = list.find(
          (item) => (item.uid || item.id) === (prev.uid || prev.id)
        );

        return matched || list[0] || null;
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
      setRedeemDateInput("");
      setRedeemTimeInput("");
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
        setRedeemDateInput("");
        setRedeemTimeInput("");
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
      setRedeemDateInput("");
      setRedeemTimeInput("");
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

      const payload = {
        name: cleanName,
        email: cleanEmail || "",
        role: "client" as const,
        cardsPurchased: 0,
        cardsUsed: 0,
        cardUsageDates: [],
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "users"), payload);

      const newClient: ClientItem = {
        id: docRef.id,
        uid: docRef.id,
        name: cleanName,
        email: cleanEmail || "",
        role: "client",
      };

      setClients((prev) =>
        [...prev, newClient].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "he")
        )
      );

      setSelectedClient(newClient);
      setManualName("");
      setManualEmail("");

      setCardData({
        cardsPurchased: 0,
        cardsUsed: 0,
        cardUsageDates: [],
      });
      setCardsPurchasedInput("0");
      setRedeemDateInput("");
      setRedeemTimeInput("");

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
      });

      setCardData((prev) => ({
        cardsPurchased: Number(prev.cardsPurchased || 0),
        cardsUsed: nextUsageDates.length,
        cardUsageDates: nextUsageDates,
      }));

      setRedeemDateInput("");
      setRedeemTimeInput("");

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

  const redeemNow = async () => {
    await redeemCardAtDate(new Date());
  };

  const redeemByChosenDateTime = async () => {
    const parsedDate = parseDateAndTime(redeemDateInput, redeemTimeInput);

    if (!parsedDate) {
      Alert.alert(
        "שגיאה",
        "יש להזין תאריך ושעה תקינים.\nתאריך לדוגמה: 2026-04-05 או 05/04/2026\nשעה לדוגמה: 18:30"
      );
      return;
    }

    await redeemCardAtDate(parsedDate);
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

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <CardsIcon size={18} color="#0F172A" />
          <Text style={[styles.headerTitle, { fontSize: dynamic.titleSize }]}>
            מימוש כרטיסייה
          </Text>
        </View>

        <Text style={[styles.headerSubtitle, { fontSize: dynamic.subTextSize }]}>
          אפשר להוסיף לקוח ידנית, להגדיר כרטיסיות, לממש לפי תאריך ושעת אימון, ולמחוק מימוש קיים
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.manualHeaderRow}>
          <PlusUserIcon size={18} color="#0F172A" />
          <Text style={styles.sectionTitle}>הוספת לקוח ידנית</Text>
        </View>

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
            <Text style={styles.primaryActionButtonText}>הוסף לקוח ידנית</Text>
          )}
        </Pressable>
      </View>

      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>אין לקוחות להצגה</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.clientsScrollContent}
          >
            {clients.map((client) => {
              const isSelected =
                (selectedClient?.uid || selectedClient?.id) === (client.uid || client.id);

              return (
                <Pressable
                  key={client.id}
                  onPress={() => setSelectedClient(client)}
                  style={({ pressed }) => [
                    styles.clientPill,
                    { minHeight: dynamic.pillHeight },
                    isSelected && styles.clientPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.clientPillName,
                      { fontSize: dynamic.textSize },
                      isSelected && styles.clientPillNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {client.name || "ללא שם"}
                  </Text>

                  <Text
                    style={[
                      styles.clientPillEmail,
                      { fontSize: dynamic.subTextSize },
                      isSelected && styles.clientPillEmailActive,
                    ]}
                    numberOfLines={1}
                  >
                    {client.email || "ללא אימייל"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedClient && (
            <View style={styles.selectedClientCard}>
              <Text style={styles.selectedClientTitle}>
                {selectedClient.name || "ללא שם"}
              </Text>
              <Text style={styles.selectedClientEmail}>
                {selectedClient.email || "ללא אימייל"}
              </Text>
            </View>
          )}

          {loadingData ? (
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
                    {usageDates[0] ? formatDateTimeIL(usageDates[0]) : "אין"}
                  </Text>
                  <Text style={styles.summaryLabel}>מימוש אחרון</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>הגדרת כרטיסיות שנרכשו</Text>

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
                <Text style={styles.sectionTitle}>מימוש כרטיסייה</Text>

                <Pressable
                  onPress={redeemNow}
                  disabled={redeemingCard || remaining <= 0}
                  style={({ pressed }) => [
                    styles.redeemNowButton,
                    pressed && styles.pressed,
                    (redeemingCard || remaining <= 0) && styles.disabledButton,
                  ]}
                >
                  {redeemingCard ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.redeemButtonText}>ממש כרטיסייה עכשיו</Text>
                  )}
                </Pressable>

                <Text style={styles.helperTitle}>מימוש לפי תאריך ושעת אימון</Text>

                <TextInput
                  value={redeemDateInput}
                  onChangeText={setRedeemDateInput}
                  placeholder="תאריך: 2026-04-05 או 05/04/2026"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  textAlign="right"
                />

                <TextInput
                  value={redeemTimeInput}
                  onChangeText={(text) => setRedeemTimeInput(text)}
                  placeholder="שעת אימון: 18:30"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  textAlign="right"
                />

                <Pressable
                  onPress={redeemByChosenDateTime}
                  disabled={redeemingCard || remaining <= 0}
                  style={({ pressed }) => [
                    styles.redeemManualButton,
                    pressed && styles.pressed,
                    (redeemingCard || remaining <= 0) && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.redeemButtonText}>ממש לפי תאריך ושעת אימון</Text>
                </Pressable>

                <Text style={styles.remainingText}>
                  כרטיסיות זמינות למימוש: {remaining}
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
                          <Text style={styles.usageDateText}>
                            מימוש {usageDates.length - index}
                          </Text>
                          <Text style={styles.usageDateText}>
                            {formatDateTimeIL(usageDate)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </>
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

  manualHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },

  clientsScrollContent: {
    gap: 10,
    paddingVertical: 2,
  },

  clientPill: {
    minWidth: 150,
    maxWidth: 220,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },

  clientPillActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },

  clientPillName: {
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "right",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  clientPillNameActive: {
    color: "#1E293B",
  },

  clientPillEmail: {
    marginTop: 4,
    color: "#64748B",
    textAlign: "right",
  },

  clientPillEmailActive: {
    color: "#475569",
  },

  selectedClientCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    alignItems: "flex-end",
  },

  selectedClientTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },

  selectedClientEmail: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 13,
    textAlign: "right",
  },

  summaryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },

  summaryCard: {
    width: "48.5%",
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

  helperTitle: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
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

  redeemNowButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
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
    opacity: 0.8,
  },

  disabledButton: {
    opacity: 0.6,
  },
});