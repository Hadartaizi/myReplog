import { MaterialIcons } from "@expo/vector-icons";
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
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { auth, db } from "../database/firebase";
import AppLayout from "./components/AppLayout";

const APP_BG = "#F4F7FB";

// ===== החליפי כאן לפרטים שלך =====
const INSTAGRAM_URL = "https://www.instagram.com/your_username/";
const WHATSAPP_PHONE = "972501234567";
const PHONE_NUMBER = "0501234567";
// =================================

export default function Menu() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 360;

  const dynamic = useMemo(() => {
    const horizontalPadding = width * 0.05;
    const cardWidth = Math.min(width * 0.92, 520);
    const titleSize = width < 380 ? 22 : 26;
    const textSize = width < 380 ? 14 : 16;
    const subtitleSize = width < 380 ? 13 : 15;
    const buttonHeight = isSmallScreen ? 50 : 56;
    const iconSize = width < 380 ? 20 : 22;

    return {
      horizontalPadding,
      cardWidth,
      titleSize,
      textSize,
      subtitleSize,
      buttonHeight,
      iconSize,
    };
  }, [width, isSmallScreen]);

  const [fontsLoaded] = useFonts({
    Bilbo: require("../assets/fonts/Bilbo-Regular.ttf"),
  });

  const [contactVisible, setContactVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }

        const userData = userSnap.data();
        const adminMode = userData.role === "admin";
        setIsAdmin(adminMode);

        if (adminMode) {
          const q = query(
            collection(db, "users"),
            where("role", "==", "client"),
          );
          const snapshot = await getDocs(q);

          const clientsList = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          clientsList.sort((a: any, b: any) =>
            (a.name || "").localeCompare(b.name || "", "he"),
          );

          setClients(clientsList);
        }
      } catch (error) {
        console.error("שגיאה בטעינת נתוני תפריט:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuData();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const openInstagram = async () => {
    try {
      const supported = await Linking.canOpenURL(INSTAGRAM_URL);
      if (supported) {
        await Linking.openURL(INSTAGRAM_URL);
      } else {
        Alert.alert("שגיאה", "לא ניתן לפתוח את אינסטגרם כרגע");
      }
    } catch (error) {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת אינסטגרם");
    }
  };

  const openWhatsApp = async () => {
    const message = encodeURIComponent("היי, אשמח לפרטים נוספים");
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${message}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("שגיאה", "לא ניתן לפתוח את וואטסאפ כרגע");
      }
    } catch (error) {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת וואטסאפ");
    }
  };

  const makePhoneCall = async () => {
    const url = `tel:${PHONE_NUMBER}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("שגיאה", "לא ניתן לבצע שיחה מהמכשיר הזה");
      }
    } catch (error) {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת השיחה");
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    Alert.alert("התנתקות", "האם את בטוחה שברצונך להתנתק?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "התנתקות",
        style: "destructive",
        onPress: async () => {
          try {
            setLoggingOut(true);
            await auth.signOut();
            router.replace("/");
          } catch (error) {
            Alert.alert("שגיאה", "אירעה בעיה בהתנתקות");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleDeleteClient = (targetUid: string) => {
    Alert.alert(
      "מחיקת לקוח",
      "האם את בטוחה שברצונך למחוק את הלקוח? הנתונים שלו יימחקו מהמערכת.",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק",
          style: "destructive",
          onPress: async () => {
            try {
              // מחיקת המשתמש מהקולקציה users
              await deleteDoc(doc(db, "users", targetUid));

              // מחיקת כל האימונים של המשתמש
              const workoutsQuery = query(
                collection(db, "workouts"),
                where("uid", "==", targetUid),
              );
              const workoutsSnap = await getDocs(workoutsQuery);
              const workoutDeletes = workoutsSnap.docs.map((docSnap) =>
                deleteDoc(doc(db, "workouts", docSnap.id)),
              );

              // מחיקת כל התרגילים של המשתמש
              const exercisesQuery = query(
                collection(db, "exercises"),
                where("uid", "==", targetUid),
              );
              const exercisesSnap = await getDocs(exercisesQuery);
              const exerciseDeletes = exercisesSnap.docs.map((docSnap) =>
                deleteDoc(doc(db, "exercises", docSnap.id)),
              );

              await Promise.all([...workoutDeletes, ...exerciseDeletes]);

              // עדכון מקומי של הרשימה
              setClients((prev) => prev.filter((c) => c.uid !== targetUid));

              Alert.alert("הצלחה", "הלקוח נמחק מהמערכת");
            } catch (error) {
              console.error("שגיאה במחיקת לקוח:", error);
              Alert.alert("שגיאה", "לא ניתן למחוק את הלקוח");
            }
          },
        },
      ],
    );
  };

  return (
    <AppLayout>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: height * 0.03,
              paddingBottom: height * 0.05,
              paddingHorizontal: dynamic.horizontalPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              {
                width: dynamic.cardWidth,
                paddingHorizontal: width * 0.05,
                paddingVertical: height * 0.03,
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

              <Text
                style={[styles.subtitle, { fontSize: dynamic.subtitleSize }]}
              >
                {isAdmin
                  ? "גישה לניהול לקוחות, יצירת קשר והתנתקות"
                  : "כאן אפשר ליצור קשר או להתנתק מהחשבון"}
              </Text>
            </View>

            {loading ? (
              <View style={styles.loaderWrapper}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={styles.loaderText}>טוען נתונים...</Text>
              </View>
            ) : (
              <>
                <View style={styles.actionsContainer}>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      { minHeight: dynamic.buttonHeight },
                    ]}
                    onPress={() => setContactVisible(true)}
                  >
                    <MaterialIcons
                      name="support-agent"
                      size={dynamic.iconSize}
                      color="#FFFFFF"
                    />
                    <Text
                      style={[
                        styles.primaryButtonText,
                        { fontSize: dynamic.textSize },
                      ]}
                    >
                      צור קשר
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.logoutButton,
                      { minHeight: dynamic.buttonHeight },
                    ]}
                    onPress={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? (
                      <ActivityIndicator color="#DC2626" />
                    ) : (
                      <>
                        <MaterialIcons
                          name="logout"
                          size={dynamic.iconSize}
                          color="#DC2626"
                        />
                        <Text
                          style={[
                            styles.logoutButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          התנתקות
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {isAdmin && (
                  <View style={styles.adminSection}>
                    <Text style={styles.adminSectionTitle}>
                      לקוחות מחוברים למערכת
                    </Text>

                    {clients.length === 0 ? (
                      <View style={styles.emptyClientsBox}>
                        <Text style={styles.emptyClientsText}>
                          אין לקוחות להצגה
                        </Text>
                      </View>
                    ) : (
                      clients.map((client) => (
                        <View key={client.id} style={styles.clientRow}>
                          <View style={styles.clientActions}>
                            <Pressable
                              onPress={() => handleDeleteClient(client.uid)}
                              style={styles.deleteClientButton}
                            >
                              <MaterialIcons
                                name="delete"
                                size={20}
                                color="#DC2626"
                              />
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
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        <Modal
          visible={contactVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setContactVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalCard, { width: Math.min(width * 0.88, 420) }]}
            >
              <Pressable
                style={styles.modalClose}
                onPress={() => setContactVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#222" />
              </Pressable>

              <Text style={styles.modalTitle}>צור קשר</Text>
              <Text style={styles.modalSubtitle}>
                בחרי איך נוח לך ליצור קשר
              </Text>

              <Pressable style={styles.contactButton} onPress={openInstagram}>
                <MaterialIcons name="photo-camera" size={20} color="#1E293B" />
                <Text style={styles.contactButtonText}>אינסטגרם</Text>
              </Pressable>

              <Pressable style={styles.contactButton} onPress={openWhatsApp}>
                <MaterialIcons name="chat" size={20} color="#1E293B" />
                <Text style={styles.contactButtonText}>וואטסאפ</Text>
              </Pressable>

              <Pressable style={styles.contactButton} onPress={makePhoneCall}>
                <MaterialIcons name="phone" size={20} color="#1E293B" />
                <Text style={styles.contactButtonText}>שיחת טלפון</Text>
              </Pressable>

              <Pressable
                onPress={() => setContactVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>סגור</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7FB",
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
  },

  loaderWrapper: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  loaderText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 15,
  },

  actionsContainer: {
    gap: 14,
  },

  primaryButton: {
    borderRadius: 18,
    backgroundColor: "#0F172A",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  logoutButton: {
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  logoutButtonText: {
    color: "#DC2626",
    fontWeight: "800",
  },

  adminSection: {
    marginTop: 24,
  },

  adminSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "right",
    marginBottom: 12,
  },

  emptyClientsBox: {
    backgroundColor: "#F8FAFC",
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
  },

  clientRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  clientInfo: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 10,
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
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },

  contactButtonText: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 16,
  },

  closeButton: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },

  closeButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    fontSize: 16,
  },
});
