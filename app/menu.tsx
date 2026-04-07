import { useFonts } from "expo-font";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { auth, db } from "../database/firebase";
import AppLayout from "./components/AppLayout";
import ClientAccessManager from "./components/admin/ClientAccessManager";
import ClientCardManager from "./components/admin/ClientCardManager";
import ClientProgressTracker from "./components/clientWorkout/ClientProgressTracker";
import {
  formatDateTimeIL,
  getRemainingTimeLabel,
} from "./components/admin/accessUtils";

const APP_BG = "#F4F7FB";

const INSTAGRAM_URL = "https://www.instagram.com/hadar_taizi/";
const WHATSAPP_PHONE = "972502507437";
const PHONE_NUMBER = "0502507437";

function AdminIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 12l1.7 1.7L14.8 10"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function GroupsIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="9" cy="9" r="3" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="16.5" cy="10" r="2.5" stroke={color} strokeWidth={2} fill="none" />
      <Path
        d="M3.5 18a5.5 5.5 0 0111 0"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M14 18a4 4 0 014-3.5A4 4 0 0122 18"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function WorkoutTrackingIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Line
        x1="8"
        y1="3.5"
        x2="8"
        y2="7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1="16"
        y1="3.5"
        x2="16"
        y2="7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line x1="4" y1="9" x2="20" y2="9" stroke={color} strokeWidth={2} />
      <Line
        x1="8"
        y1="13"
        x2="11"
        y2="13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1="8"
        y1="16"
        x2="14"
        y2="16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

type ClientItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: "admin" | "client";
  approvalStatus?: "pending" | "approved" | "blocked";
  accessStartAt?: string | null;
  accessEndAt?: string | null;
};

type CurrentUserData = {
  name?: string;
  email?: string;
  role?: "admin" | "client";
  approvalStatus?: "pending" | "approved" | "blocked";
  accessStartAt?: string | null;
  accessEndAt?: string | null;
  cardsPurchased?: number;
  cardsUsed?: number;
  cardUsageDates?: string[];
};

export default function Menu() {
  const { width, height } = useWindowDimensions();

  const isVerySmall = width < 340;
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  const dynamic = useMemo(() => {
    const horizontalPadding = isTablet ? width * 0.04 : width * 0.05;
    const cardWidth = Math.min(width * 0.94, 760);
    const titleSize = isVerySmall ? 21 : isSmallScreen ? 23 : isTablet ? 30 : 26;
    const textSize = isVerySmall ? 13 : isSmallScreen ? 14 : 16;
    const subtitleSize = isVerySmall ? 12 : isSmallScreen ? 13 : 15;
    const buttonHeight = isVerySmall ? 54 : isSmallScreen ? 58 : 62;
    const iconSize = isVerySmall ? 18 : 20;
    const cardPaddingHorizontal = isVerySmall ? 14 : isSmallScreen ? 18 : isTablet ? 30 : 22;
    const cardPaddingVertical = isVerySmall ? 18 : isTablet ? 30 : 24;

    return {
      horizontalPadding,
      cardWidth,
      titleSize,
      textSize,
      subtitleSize,
      buttonHeight,
      iconSize,
      cardPaddingHorizontal,
      cardPaddingVertical,
    };
  }, [width, isVerySmall, isSmallScreen, isTablet]);

  const [fontsLoaded] = useFonts({
    Bilbo: require("../assets/fonts/Bilbo-Regular.ttf"),
  });

  const [contactVisible, setContactVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [adminActionsOpen, setAdminActionsOpen] = useState(false);
  const [clientsSectionOpen, setClientsSectionOpen] = useState(false);
  const [deleteClientsOpen, setDeleteClientsOpen] = useState(false);
  const [accessManagementOpen, setAccessManagementOpen] = useState(false);
  const [trainingManagementOpen, setTrainingManagementOpen] = useState(false);
  const [clientWorkoutTrackingOpen, setClientWorkoutTrackingOpen] = useState(false);
  const [clientCardManagerOpen, setClientCardManagerOpen] = useState(false);
  const [accessInfoOpen, setAccessInfoOpen] = useState(false);
  const [cardHistoryOpen, setCardHistoryOpen] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<CurrentUserData | null>(null);

  const fetchMenuData = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setCurrentUserData(null);
        setClients([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setCurrentUserData(null);
        setClients([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const userData = userSnap.data() as CurrentUserData;
      setCurrentUserData(userData);

      const adminMode = userData.role === "admin";
      setIsAdmin(adminMode);

      if (adminMode) {
        const q = query(collection(db, "users"), where("role", "==", "client"));
        const snapshot = await getDocs(q);

        const clientsList: ClientItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientItem, "id">),
        }));

        clientsList.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
        setClients(clientsList);
      } else {
        setClients([]);
      }
    } catch (error) {
      console.error("שגיאה בטעינת נתוני תפריט:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const confirmAction = async (title: string, message: string) => {
    if (Platform.OS === "web") {
      return window.confirm(`${title}\n\n${message}`);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: "ביטול", style: "cancel", onPress: () => resolve(false) },
        { text: "אישור", onPress: () => resolve(true) },
      ]);
    });
  };

  const openInstagram = async () => {
    try {
      await Linking.openURL(INSTAGRAM_URL);
    } catch {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת אינסטגרם");
    }
  };

  const openWhatsApp = async () => {
    const message = encodeURIComponent("היי, אשמח לפרטים נוספים");
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${message}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת וואטסאפ");
    }
  };

  const makePhoneCall = async () => {
    try {
      await Linking.openURL(`tel:${PHONE_NUMBER}`);
    } catch {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת השיחה");
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    const confirmed = await confirmAction("התנתקות", "האם את בטוחה שברצונך להתנתק?");
    if (!confirmed) return;

    try {
      setLoggingOut(true);
      await auth.signOut();
      router.replace("/");
    } catch (error) {
      console.error("שגיאה בהתנתקות:", error);
      Platform.OS === "web"
        ? window.alert("אירעה בעיה בהתנתקות")
        : Alert.alert("שגיאה", "אירעה בעיה בהתנתקות");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteClient = async (targetUid: string) => {
    const confirmed = await confirmAction(
      "מחיקת לקוח",
      "האם את בטוחה שברצונך למחוק את הלקוח? הנתונים שלו יימחקו מהמערכת."
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "users", targetUid));

      const workoutsQuery = query(collection(db, "workouts"), where("uid", "==", targetUid));
      const workoutsSnap = await getDocs(workoutsQuery);

      const exercisesQuery = query(collection(db, "exercises"), where("uid", "==", targetUid));
      const exercisesSnap = await getDocs(exercisesQuery);

      await Promise.all([
        ...workoutsSnap.docs.map((d) => deleteDoc(doc(db, "workouts", d.id))),
        ...exercisesSnap.docs.map((d) => deleteDoc(doc(db, "exercises", d.id))),
      ]);

      setClients((prev) => prev.filter((c) => (c.uid || c.id) !== targetUid));

      Platform.OS === "web"
        ? window.alert("הלקוח נמחק מהמערכת")
        : Alert.alert("הצלחה", "הלקוח נמחק מהמערכת");
    } catch (error) {
      console.error("שגיאה במחיקת לקוח:", error);
      Platform.OS === "web"
        ? window.alert("לא ניתן למחוק את הלקוח")
        : Alert.alert("שגיאה", "לא ניתן למחוק את הלקוח");
    }
  };

  const currentApprovalLabel =
    currentUserData?.approvalStatus === "approved"
      ? "מאושר"
      : currentUserData?.approvalStatus === "blocked"
      ? "חסום"
      : "ממתין לאישור";

  const cardsPurchased = Number(currentUserData?.cardsPurchased || 0);

  const cardUsageDates = Array.isArray(currentUserData?.cardUsageDates)
    ? [...currentUserData.cardUsageDates].sort(
        (a, b) => (new Date(b).getTime() || 0) - (new Date(a).getTime() || 0)
      )
    : [];

  const cardsUsed = cardUsageDates.length;
  const cardsRemaining = Math.max(cardsPurchased - cardsUsed, 0);
  const lastCardUsage = cardUsageDates[0] || null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppLayout>
          <View style={styles.screen}>
            <View style={styles.loadingScreen}>
              <ActivityIndicator size="large" color="#0F172A" />
              <Text style={styles.loaderText}>טוען נתונים...</Text>
            </View>
          </View>
        </AppLayout>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppLayout>
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: Math.max(height * 0.025, 18),
                paddingBottom: Math.max(height * 0.05, 32),
                paddingHorizontal: dynamic.horizontalPadding,
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.card,
                {
                  width: dynamic.cardWidth,
                  paddingHorizontal: dynamic.cardPaddingHorizontal,
                  paddingVertical: dynamic.cardPaddingVertical,
                },
              ]}
            >
              <View style={styles.header}>
                <Text
                  style={[
                    styles.title,
                    {
                      fontSize: dynamic.titleSize,
                      lineHeight: dynamic.titleSize * 1.45,
                    },
                  ]}
                >
                  תפריט
                </Text>

                <Text style={[styles.subtitle, { fontSize: dynamic.subtitleSize }]}>
                  {isAdmin
                    ? "כאן אפשר ליצור קשר, להתנתק ולצפות בפעולות ניהול"
                    : "כאן אפשר ליצור קשר, להתנתק ולראות את מצב הגישה שלך"}
                </Text>
              </View>

              <View style={styles.actionsContainer}>
                {!isAdmin && currentUserData && (
                  <View style={styles.accessWrapper}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.userSectionButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setAccessInfoOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <Text
                          style={[
                            styles.userSectionButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          פרטי גישה למערכת
                        </Text>

                        <Text style={styles.expandText}>
                          {accessInfoOpen ? "הסתרה" : "הצגה"}
                        </Text>
                      </View>
                    </Pressable>

                    {accessInfoOpen && (
                      <View style={styles.userSectionContent}>
                        <View style={styles.accessCard}>
                          <View style={styles.accessRow}>
                            <Text style={styles.accessLabel}>סטטוס</Text>
                            <Text style={styles.accessValue}>{currentApprovalLabel}</Text>
                          </View>

                          <View style={styles.accessRow}>
                            <Text style={styles.accessLabel}>תחילת גישה</Text>
                            <Text style={styles.accessValue}>
                              {formatDateTimeIL(currentUserData.accessStartAt)}
                            </Text>
                          </View>

                          <View style={styles.accessRow}>
                            <Text style={styles.accessLabel}>סיום גישה</Text>
                            <Text style={styles.accessValue}>
                              {formatDateTimeIL(currentUserData.accessEndAt)}
                            </Text>
                          </View>

                          <View style={[styles.accessRow, styles.accessRowLast]}>
                            <Text style={styles.accessLabel}>זמן נותר</Text>
                            <Text style={styles.accessValue}>
                              {getRemainingTimeLabel(currentUserData.accessEndAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    <Pressable
                      style={({ pressed }) => [
                        styles.userSectionButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setCardHistoryOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <Text
                          style={[
                            styles.userSectionButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          היסטוריית כרטיסיות
                        </Text>

                        <Text style={styles.expandText}>
                          {cardHistoryOpen ? "הסתרה" : "הצגה"}
                        </Text>
                      </View>
                    </Pressable>

                    {cardHistoryOpen && (
                      <View style={styles.userSectionContent}>
                        <View style={styles.clientCardsInfoCard}>
                          <View style={styles.clientCardsHeader}>
                            <Text style={styles.clientCardsInfoTitle}>היסטוריית כרטיסיות</Text>
                            <Text style={styles.clientCardsInfoSubtitle}>
                              כאן אפשר לראות את מצב הכרטיסייה והמימושים שבוצעו
                            </Text>
                          </View>

                          <View style={styles.clientCardsTopStatsRow}>
                            <View style={styles.clientCardsMiniStatBox}>
                              <Text style={styles.clientCardsMiniValue}>{cardsPurchased}</Text>
                              <Text style={styles.clientCardsMiniLabel}>נרכשו</Text>
                            </View>

                            <View style={styles.clientCardsMiniStatBox}>
                              <Text style={styles.clientCardsMiniValue}>{cardsUsed}</Text>
                              <Text style={styles.clientCardsMiniLabel}>מומשו</Text>
                            </View>

                            <View style={styles.clientCardsMiniStatBox}>
                              <Text style={styles.clientCardsMiniValue}>{cardsRemaining}</Text>
                              <Text style={styles.clientCardsMiniLabel}>נותרו</Text>
                            </View>
                          </View>

                          <View style={styles.clientCardsHighlightBox}>
                            <View style={styles.clientCardsHighlightTextWrap}>
                              <Text style={styles.clientCardsHighlightLabel}>מימוש אחרון</Text>
                              <Text style={styles.clientCardsHighlightValue}>
                                {lastCardUsage
                                  ? formatDateTimeIL(lastCardUsage)
                                  : "עדיין לא בוצע מימוש"}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.cardUsageHistoryBox}>
                            <View style={styles.cardUsageHistoryHeader}>
                              <Text style={styles.cardUsageHistoryTitle}>רשימת מימושים</Text>
                              <Text style={styles.cardUsageHistoryCount}>
                                {cardUsageDates.length} מימושים
                              </Text>
                            </View>

                            {cardUsageDates.length === 0 ? (
                              <View style={styles.emptyCardHistoryBox}>
                                <Text style={styles.emptyCardHistoryText}>
                                  עדיין לא בוצעו מימושים
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.cardUsageList}>
                                {cardUsageDates.map((usageDate, index) => (
                                  <View key={`${usageDate}-${index}`} style={styles.cardUsageRow}>
                                    <View style={styles.cardUsageOrderBadge}>
                                      <Text style={styles.cardUsageOrderBadgeText}>
                                        {cardUsageDates.length - index}
                                      </Text>
                                    </View>

                                    <View style={styles.cardUsageContent}>
                                      <Text style={styles.cardUsageMainText}>מימוש כרטיסייה</Text>
                                      <Text style={styles.cardUsageSubText}>
                                        {formatDateTimeIL(usageDate)}
                                      </Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { minHeight: dynamic.buttonHeight },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setContactVisible(true)}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { fontSize: dynamic.textSize },
                    ]}
                  >
                    צור קשר
                  </Text>
                </Pressable>

                {isAdmin && (
                  <View style={styles.adminWrapper}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.adminMainButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setAdminActionsOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <View style={styles.mainButtonContent}>
                          <View style={styles.iconWrap}>
                            <AdminIcon size={dynamic.iconSize} color="#1E293B" />
                          </View>

                          <Text
                            style={[
                              styles.adminMainButtonText,
                              { fontSize: dynamic.textSize },
                            ]}
                            numberOfLines={1}
                          >
                            פעולות למנהל
                          </Text>
                        </View>

                        <Text style={styles.mainExpandText}>
                          {adminActionsOpen ? "סגירה" : "פתיחה"}
                        </Text>
                      </View>
                    </Pressable>

                    {adminActionsOpen && (
                      <View style={styles.adminDropdown}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.categoryButton,
                            { minHeight: dynamic.buttonHeight - 2 },
                            pressed && styles.pressedLight,
                          ]}
                          onPress={() => setClientsSectionOpen((prev) => !prev)}
                        >
                          <View style={styles.buttonRow}>
                            <View style={styles.categoryButtonContent}>
                              <View style={styles.iconWrap}>
                                <GroupsIcon size={20} color="#0F172A" />
                              </View>

                              <Text style={styles.categoryButtonText} numberOfLines={1}>
                                ניהול לקוחות
                              </Text>
                            </View>

                            <Text style={styles.categoryExpandText}>
                              {clientsSectionOpen ? "סגירה" : "פתיחה"}
                            </Text>
                          </View>
                        </Pressable>

                        {clientsSectionOpen && (
                          <View style={styles.categoryContent}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setDeleteClientsOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>מחיקת לקוח</Text>
                                <Text style={styles.subActionExpandText}>
                                  {deleteClientsOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {deleteClientsOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  clients.map((client) => {
                                    const targetUid = client.uid || client.id;

                                    return (
                                      <View key={`delete-${client.id}`} style={styles.clientRow}>
                                        <View style={styles.clientActions}>
                                          <Pressable
                                            style={({ pressed }) => [
                                              styles.deleteClientButton,
                                              pressed && styles.deletePressed,
                                            ]}
                                            onPress={() => handleDeleteClient(targetUid)}
                                            hitSlop={10}
                                          >
                                            <Text style={styles.deleteClientButtonText}>מחקי</Text>
                                          </Pressable>
                                        </View>

                                        <View style={styles.clientInfo}>
                                          <Text style={styles.clientName}>
                                            {client.name || "ללא שם"}
                                          </Text>

                                          <Text style={styles.clientEmail}>
                                            {client.email || "ללא אימייל"}
                                          </Text>
                                        </View>
                                      </View>
                                    );
                                  })
                                )}
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setAccessManagementOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>הגדרת תקופת גישה</Text>
                                <Text style={styles.subActionExpandText}>
                                  {accessManagementOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {accessManagementOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientAccessManager onAfterUpdate={fetchMenuData} />
                                )}
                              </View>
                            )}
                          </View>
                        )}

                        <Pressable
                          style={({ pressed }) => [
                            styles.categoryButton,
                            { minHeight: dynamic.buttonHeight - 2 },
                            pressed && styles.pressedLight,
                          ]}
                          onPress={() => setTrainingManagementOpen((prev) => !prev)}
                        >
                          <View style={styles.buttonRow}>
                            <View style={styles.categoryButtonContent}>
                              <View style={styles.iconWrap}>
                                <WorkoutTrackingIcon size={20} color="#0F172A" />
                              </View>

                              <Text style={styles.categoryButtonText} numberOfLines={1}>
                                ניהול אימונים וכרטיסיות
                              </Text>
                            </View>

                            <Text style={styles.categoryExpandText}>
                              {trainingManagementOpen ? "סגירה" : "פתיחה"}
                            </Text>
                          </View>
                        </Pressable>

                        {trainingManagementOpen && (
                          <View style={styles.categoryContent}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setClientWorkoutTrackingOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>
                                  מעקב אחרי אימון לקוח
                                </Text>
                                <Text style={styles.subActionExpandText}>
                                  {clientWorkoutTrackingOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {clientWorkoutTrackingOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientProgressTracker clients={clients} />
                                )}
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setClientCardManagerOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>מימוש כרטיסייה</Text>
                                <Text style={styles.subActionExpandText}>
                                  {clientCardManagerOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {clientCardManagerOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientCardManager
                                    clients={clients}
                                    onAfterUpdate={fetchMenuData}
                                  />
                                )}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.logoutButton,
                    { minHeight: dynamic.buttonHeight },
                    pressed && styles.logoutPressed,
                    loggingOut && styles.disabledButton,
                  ]}
                  onPress={handleLogout}
                  disabled={loggingOut}
                  hitSlop={6}
                >
                  {loggingOut ? (
                    <ActivityIndicator color="#DC2626" />
                  ) : (
                    <Text
                      style={[
                        styles.logoutButtonText,
                        { fontSize: dynamic.textSize },
                      ]}
                    >
                      התנתקות
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <Modal
            visible={contactVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setContactVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { width: Math.min(width * 0.9, 420) }]}>
                <Text style={styles.modalTitle}>צור קשר</Text>
                <Text style={styles.modalSubtitle}>בחרי איך נוח לך ליצור קשר</Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.contactButton,
                    { minHeight: dynamic.buttonHeight - 2 },
                    pressed && styles.pressedLight,
                  ]}
                  onPress={openInstagram}
                >
                  <Text style={styles.contactButtonText}>אינסטגרם</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.contactButton,
                    { minHeight: dynamic.buttonHeight - 2 },
                    pressed && styles.pressedLight,
                  ]}
                  onPress={openWhatsApp}
                >
                  <Text style={styles.contactButtonText}>וואטסאפ</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.contactButton,
                    { minHeight: dynamic.buttonHeight - 2 },
                    pressed && styles.pressedLight,
                  ]}
                  onPress={makePhoneCall}
                >
                  <Text style={styles.contactButtonText}>שיחת טלפון</Text>
                </Pressable>

                <Pressable
                  onPress={() => setContactVisible(false)}
                  style={({ pressed }) => [
                    styles.closeButton,
                    { minHeight: dynamic.buttonHeight - 4 },
                    pressed && styles.pressedLight,
                  ]}
                >
                  <Text style={styles.closeButtonText}>סגור</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      </AppLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  screen: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },

  header: {
    alignItems: "center",
    marginBottom: 26,
  },

  title: {
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
  },

  subtitle: {
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },

  loaderText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 15,
    textAlign: "center",
  },

  actionsContainer: {
    gap: 14,
    width: "100%",
  },

  buttonRow: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  mainButtonContent: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },

  categoryButtonContent: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },

  primaryButton: {
    borderRadius: 18,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
  },

  accessWrapper: {
    width: "100%",
    gap: 10,
  },

  userSectionButton: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D7DFE9",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
    justifyContent: "center",
  },

  userSectionButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },

  userSectionContent: {
    marginRight: 8,
    paddingRight: 12,
    borderRightWidth: 3,
    borderRightColor: "#DCE6F4",
  },

  expandText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
  },

  adminWrapper: {
    width: "100%",
    gap: 12,
  },

  adminMainButton: {
    borderRadius: 20,
    backgroundColor: "#E8EEFF",
    borderWidth: 1.5,
    borderColor: "#B8C8FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    width: "100%",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },

  adminMainButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    textAlign: "right",
  },

  mainExpandText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "left",
  },

  adminDropdown: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    width: "100%",
    gap: 12,
  },

  categoryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: "100%",
    justifyContent: "center",
  },

  categoryButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "right",
  },

  categoryExpandText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "left",
  },

  categoryContent: {
    gap: 10,
    marginTop: 2,
    marginRight: 10,
    paddingRight: 14,
    borderRightWidth: 4,
    borderRightColor: "#C7D7F8",
  },

  subActionButton: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    paddingVertical: 13,
    paddingHorizontal: 15,
    width: "100%",
    justifyContent: "center",
  },

  subActionButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "right",
    flex: 1,
  },

  subActionExpandText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
  },

  subActionContent: {
    marginTop: 6,
    marginRight: 8,
    paddingRight: 12,
    gap: 10,
    borderRightWidth: 2,
    borderRightColor: "#E2E8F0",
  },

  accessCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },

  accessRow: {
    width: "100%",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 12,
  },

  accessRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  accessLabel: {
    width: 92,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "700",
    textAlign: "right",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  accessValue: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },

  clientCardsInfoCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  clientCardsHeader: {
    alignItems: "flex-end",
    gap: 4,
  },

  clientCardsInfoTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },

  clientCardsInfoSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },

  clientCardsTopStatsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 10,
  },

  clientCardsMiniStatBox: {
    flex: 1,
    minHeight: 96,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },

  clientCardsMiniValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },

  clientCardsMiniLabel: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  clientCardsHighlightBox: {
    width: "100%",
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  clientCardsHighlightTextWrap: {
    alignItems: "flex-end",
    gap: 6,
  },

  clientCardsHighlightLabel: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },

  clientCardsHighlightValue: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 22,
  },

  cardUsageHistoryBox: {
    marginTop: 2,
    gap: 12,
  },

  cardUsageHistoryHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardUsageHistoryTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },

  cardUsageHistoryCount: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "left",
  },

  cardUsageList: {
    gap: 10,
  },

  cardUsageRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },

  cardUsageOrderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E0E7FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },

  cardUsageOrderBadgeText: {
    color: "#3730A3",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  cardUsageContent: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },

  cardUsageMainText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },

  cardUsageSubText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },

  emptyCardHistoryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCardHistoryText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  emptyClientsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
  },

  emptyClientsText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },

  clientRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },

  clientInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  clientName: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "right",
  },

  clientEmail: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "right",
    marginTop: 4,
  },

  clientActions: {
    justifyContent: "center",
    alignItems: "center",
  },

  deleteClientButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  deleteClientButtonText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  logoutButton: {
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },

  logoutButtonText: {
    color: "#DC2626",
    fontWeight: "800",
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
  },

  modalTitle: {
    textAlign: "center",
    fontWeight: "800",
    fontSize: 22,
    color: "#0F172A",
    marginBottom: 8,
  },

  modalSubtitle: {
    textAlign: "center",
    color: "#64748B",
    marginBottom: 18,
    fontSize: 14,
  },

  contactButton: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 10,
  },

  contactButtonText: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    width: "100%",
  },

  closeButton: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    width: "100%",
  },

  closeButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.85,
  },

  pressedLight: {
    opacity: 0.75,
  },

  logoutPressed: {
    opacity: 0.8,
  },

  deletePressed: {
    opacity: 0.7,
  },

  disabledButton: {
    opacity: 0.6,
  },
});