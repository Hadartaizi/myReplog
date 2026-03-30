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
import ClientProgressTracker from "./components/clientWorkout/ClientProgressTracker";
import {
  formatDateTimeIL,
  getRemainingTimeLabel,
} from "./components/admin/accessUtils";

const APP_BG = "#F4F7FB";

const INSTAGRAM_URL = "https://www.instagram.com/hadar_taizi/";
const WHATSAPP_PHONE = "972502507437";
const PHONE_NUMBER = "0502507437";

function SupportIcon({ size = 22, color = "#FFFFFF" }) {
  return (
    <Svg width={size} height={size} viewBox="0 -1 24 26">
      <Circle cx="12" cy="8" r="3" stroke={color} strokeWidth={2} fill="none" />
      <Path
        d="M5 18v-1a4 4 0 014-4h6a4 4 0 014 4v1"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M4 10V8a8 8 0 0116 0v2"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Rect
        x="2.5"
        y="10"
        width="3"
        height="5.5"
        rx="1.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Rect
        x="18.5"
        y="10"
        width="3"
        height="5.5"
        rx="1.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

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

function ArrowDownIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ArrowUpIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M18 15l-6-6-6 6"
        stroke={color}
        strokeWidth={2.4}
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

function DeleteIcon({ size = 20, color = "#DC2626" }) {
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

function LogoutIcon({ size = 20, color = "#DC2626" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M10 17l-5-5 5-5"
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="5" y1="12" x2="15" y2="12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path
        d="M14 5h3a2 2 0 012 2v10a2 2 0 01-2 2h-3"
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CloseIcon({ size = 24, color = "#222222" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function CameraIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="7" width="18" height="12" rx="3" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="12" cy="13" r="3.2" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M8 7l1.2-2h5.6L16 7" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function ChatIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 18l-2 2V6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Line x1="8" y1="9" x2="16" y2="9" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="8" y1="13" x2="14" y2="13" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PhoneIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.5 4.5l3 3-1.7 2.8a14.5 14.5 0 005.1 5.1l2.8-1.7 3 3-1.7 2.8a2.5 2.5 0 01-2.9 1c-6.1-2-11-6.9-13-13a2.5 2.5 0 011-2.9L6.5 4.5z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WorkoutTrackingIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="10" width="4" height="4" rx="1" fill={color} />
      <Rect x="17" y="10" width="4" height="4" rx="1" fill={color} />
      <Line x1="7" y1="12" x2="17" y2="12" stroke={color} strokeWidth={2.4} />
      <Line x1="3" y1="8" x2="3" y2="16" stroke={color} strokeWidth={2.4} />
      <Line x1="21" y1="8" x2="21" y2="16" stroke={color} strokeWidth={2.4} />
      <Path
        d="M8 6h8"
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
  const [clientWorkoutTrackingOpen, setClientWorkoutTrackingOpen] = useState(false);
  const [accessInfoOpen, setAccessInfoOpen] = useState(false);
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
                        styles.accessToggleButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setAccessInfoOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <View style={styles.leftSlot}>
                          {accessInfoOpen ? (
                            <ArrowUpIcon size={20} color="#1E293B" />
                          ) : (
                            <ArrowDownIcon size={20} color="#1E293B" />
                          )}
                        </View>

                        <View style={styles.centerContent}>
                          <Text
                            style={[
                              styles.accessToggleButtonText,
                              { fontSize: dynamic.textSize },
                            ]}
                            numberOfLines={1}
                          >
                            פרטי גישה למערכת
                          </Text>
                        </View>

                        <View style={styles.rightSlot} />
                      </View>
                    </Pressable>

                    {accessInfoOpen && (
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
                  <View style={styles.buttonRow}>
                    <View style={styles.leftSlot} />
                    <View style={styles.centerContent}>
                      <View style={styles.iconWrap}>
                        <SupportIcon size={dynamic.iconSize + 4} color="#FFFFFF" />
                      </View>
                      <Text
                        style={[
                          styles.primaryButtonText,
                          { fontSize: dynamic.textSize },
                        ]}
                      >
                        צור קשר
                      </Text>
                    </View>
                    <View style={styles.rightSlot} />
                  </View>
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
                        <View style={styles.leftSlot}>
                          {adminActionsOpen ? (
                            <ArrowUpIcon size={20} color="#1E293B" />
                          ) : (
                            <ArrowDownIcon size={20} color="#1E293B" />
                          )}
                        </View>

                        <View style={styles.centerContent}>
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

                        <View style={styles.rightSlot} />
                      </View>
                    </Pressable>

                    {adminActionsOpen && (
                      <View style={styles.adminDropdown}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.adminSubButton,
                            { minHeight: dynamic.buttonHeight - 2 },
                            pressed && styles.pressedLight,
                          ]}
                          onPress={() => setClientsSectionOpen((prev) => !prev)}
                        >
                          <View style={styles.buttonRow}>
                            <View style={styles.leftSlot}>
                              {clientsSectionOpen ? (
                                <ArrowUpIcon size={20} color="#0F172A" />
                              ) : (
                                <ArrowDownIcon size={20} color="#0F172A" />
                              )}
                            </View>

                            <View style={styles.centerContent}>
                              <View style={styles.iconWrap}>
                                <GroupsIcon size={20} color="#0F172A" />
                              </View>
                              <Text style={styles.adminSubButtonText} numberOfLines={1}>
                                ניהול לקוחות
                              </Text>
                            </View>

                            <View style={styles.rightSlot} />
                          </View>
                        </Pressable>

                        {clientsSectionOpen && (
                          <View style={styles.clientsBox}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.adminSubButton,
                                { minHeight: dynamic.buttonHeight - 6 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setDeleteClientsOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <View style={styles.leftSlot}>
                                  {deleteClientsOpen ? (
                                    <ArrowUpIcon size={20} color="#0F172A" />
                                  ) : (
                                    <ArrowDownIcon size={20} color="#0F172A" />
                                  )}
                                </View>

                                <View style={styles.centerContent}>
                                  <View style={styles.iconWrap}>
                                    <DeleteIcon size={18} color="#0F172A" />
                                  </View>
                                  <Text style={styles.adminSubButtonText} numberOfLines={1}>
                                    מחיקת לקוח
                                  </Text>
                                </View>

                                <View style={styles.rightSlot} />
                              </View>
                            </Pressable>

                            {deleteClientsOpen && (
                              <View style={styles.clientsInnerBox}>
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
                                            <DeleteIcon size={20} color="#DC2626" />
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
                                styles.adminSubButton,
                                { minHeight: dynamic.buttonHeight - 6 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setAccessManagementOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <View style={styles.leftSlot}>
                                  {accessManagementOpen ? (
                                    <ArrowUpIcon size={20} color="#0F172A" />
                                  ) : (
                                    <ArrowDownIcon size={20} color="#0F172A" />
                                  )}
                                </View>

                                <View style={styles.centerContent}>
                                  <View style={styles.iconWrap}>
                                    <AdminIcon size={18} color="#0F172A" />
                                  </View>
                                  <Text style={styles.adminSubButtonText} numberOfLines={1}>
                                    הגדרת תקופת גישה
                                  </Text>
                                </View>

                                <View style={styles.rightSlot} />
                              </View>
                            </Pressable>

                            {accessManagementOpen && (
                              <View style={styles.clientsInnerBox}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientAccessManager
                                    onAfterUpdate={fetchMenuData}
                                  />
                                )}
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.adminSubButton,
                                { minHeight: dynamic.buttonHeight - 6 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() =>
                                setClientWorkoutTrackingOpen((prev) => !prev)
                              }
                            >
                              <View style={styles.buttonRow}>
                                <View style={styles.leftSlot}>
                                  {clientWorkoutTrackingOpen ? (
                                    <ArrowUpIcon size={20} color="#0F172A" />
                                  ) : (
                                    <ArrowDownIcon size={20} color="#0F172A" />
                                  )}
                                </View>

                                <View style={styles.centerContent}>
                                  <View style={styles.iconWrap}>
                                    <WorkoutTrackingIcon size={18} color="#0F172A" />
                                  </View>
                                  <Text style={styles.adminSubButtonText} numberOfLines={1}>
                                    מעקב אחרי אימון לקוח
                                  </Text>
                                </View>

                                <View style={styles.rightSlot} />
                              </View>
                            </Pressable>

                            {clientWorkoutTrackingOpen && (
                              <View style={styles.clientsInnerBox}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientProgressTracker clients={clients} />
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
                    <View style={styles.buttonRow}>
                      <View style={styles.leftSlot} />
                      <View style={styles.centerContent}>
                        <View style={styles.iconWrap}>
                          <LogoutIcon size={dynamic.iconSize} color="#DC2626" />
                        </View>
                        <Text
                          style={[
                            styles.logoutButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          התנתקות
                        </Text>
                      </View>
                      <View style={styles.rightSlot} />
                    </View>
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
                <Pressable
                  style={styles.modalClose}
                  onPress={() => setContactVisible(false)}
                  hitSlop={10}
                >
                  <CloseIcon size={24} color="#222222" />
                </Pressable>

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
                  <View style={styles.contactButtonInner}>
                    <View style={styles.iconWrap}>
                      <CameraIcon size={20} color="#1E293B" />
                    </View>
                    <Text style={styles.contactButtonText}>אינסטגרם</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.contactButton,
                    { minHeight: dynamic.buttonHeight - 2 },
                    pressed && styles.pressedLight,
                  ]}
                  onPress={openWhatsApp}
                >
                  <View style={styles.contactButtonInner}>
                    <View style={styles.iconWrap}>
                      <ChatIcon size={20} color="#1E293B" />
                    </View>
                    <Text style={styles.contactButtonText}>וואטסאפ</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.contactButton,
                    { minHeight: dynamic.buttonHeight - 2 },
                    pressed && styles.pressedLight,
                  ]}
                  onPress={makePhoneCall}
                >
                  <View style={styles.contactButtonInner}>
                    <View style={styles.iconWrap}>
                      <PhoneIcon size={20} color="#1E293B" />
                    </View>
                    <Text style={styles.contactButtonText}>שיחת טלפון</Text>
                  </View>
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

  accessWrapper: {
    width: "100%",
    gap: 10,
  },

  accessToggleButton: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D7DFE9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },

  accessToggleButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    textAlign: "center",
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

  buttonRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },

  leftSlot: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  rightSlot: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  centerContent: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 0,
  },

  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
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

  adminWrapper: {
    width: "100%",
    gap: 10,
  },

  adminMainButton: {
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },

  adminMainButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    textAlign: "center",
  },

  adminDropdown: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    width: "100%",
  },

  adminSubButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: "100%",
  },

  adminSubButtonText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },

  clientsBox: {
    marginTop: 12,
    gap: 10,
  },

  clientsInnerBox: {
    marginTop: 10,
    gap: 10,
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
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
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

  modalClose: {
    alignSelf: "flex-start",
    marginBottom: 6,
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

  contactButtonInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  contactButtonText: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
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