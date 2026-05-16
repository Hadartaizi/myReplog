import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ImageBackground,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { auth, db } from "../database/firebase.js";
import { getAccessState } from "./components/admin/accessUtils";

const APP_BG = "#0B0B0D";
const OPEN_LOGO_BG = require("../public/openLogo.png");

function MailIcon({ size = 22, color = "#FF7A00" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M4 8l8 6 8-6" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function EyeIcon({ size = 22, color = "#FF7A00" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function EyeOffIcon({ size = 22, color = "#FF7A00" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function Index() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [isHydrated, setIsHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const ui = useMemo(() => {
    const safeWidth = Math.min(width || 430, 430);
    const isSmallScreen = safeWidth < 360;
    const isTablet = (width || 0) >= 768;

    return {
      isSmallScreen,
      isTablet,
      horizontalPadding: isTablet ? 32 : safeWidth < 380 ? 18 : 24,
      cardMaxWidth: isTablet ? 520 : 460,
      inputFontSize: isSmallScreen ? 14 : 16,
      buttonFontSize: isSmallScreen ? 15 : 16,
      topSpacer: isTablet ? 360 : Math.max(280, (height || 700) * 0.42),
    };
  }, [width, height]);

  if (!isHydrated) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogin = async () => {
    setErrorMessage("");
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setErrorMessage("אנא הזיני אימייל וסיסמה");
      return;
    }

    try {
      setIsLoading(true);

      if (Platform.OS === "web") {
        await setPersistence(auth, browserSessionPersistence);
      }

      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await signOut(auth);
        setErrorMessage("לא נמצאו פרטי משתמש. יש להתחבר מחדש");
        return;
      }

      const userData = userSnap.data();
      const accessState = getAccessState(userData);

      if (!accessState.allowed) {
        await signOut(auth);

        switch (accessState.reason) {
          case "blocked":
            setErrorMessage("החשבון שלך נחסם");
            showMessage("החשבון חסום", "הגישה שלך למערכת נחסמה. יש לפנות למנהל המערכת.");
            return;
          case "pending_approval":
            setErrorMessage("החשבון עדיין לא אושר");
            showMessage("החשבון עדיין לא אושר", "ההרשמה נקלטה בהצלחה. יש להמתין לאישור סופי ממנהל המערכת.");
            return;
          case "expired":
            setErrorMessage("תקופת הגישה שלך הסתיימה");
            showMessage("הגישה הסתיימה", "תקופת הגישה שהוגדרה עבורך הסתיימה.");
            return;
          case "not_started_yet":
            setErrorMessage("תקופת הגישה שלך עדיין לא התחילה");
            showMessage("הגישה עדיין לא התחילה", "תקופת הגישה שלך עדיין לא התחילה.");
            return;
          default:
            setErrorMessage("אין כרגע הרשאת גישה למערכת");
            showMessage("אין גישה למערכת", "אין כרגע הרשאת גישה למערכת.");
            return;
        }
      }

      router.replace("/home");
    } catch (error: any) {
      switch (error?.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setErrorMessage("אימייל או סיסמה שגויים");
          break;
        case "auth/invalid-email":
          setErrorMessage("כתובת האימייל אינה תקינה");
          break;
        case "auth/too-many-requests":
          setErrorMessage("בוצעו יותר מדי ניסיונות. נסי שוב מאוחר יותר");
          break;
        default:
          setErrorMessage("אירעה שגיאה, אנא נסי שוב");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    setResetEmail(email.trim());
    setResetModalVisible(true);
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = resetEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert("חסר אימייל", "אנא הזיני כתובת אימייל");
      return;
    }

    try {
      setIsResetLoading(true);
      auth.languageCode = "he";
      await sendPasswordResetEmail(auth, trimmedEmail);
      setResetModalVisible(false);
      setEmail(trimmedEmail);
      Alert.alert("נשלח מייל לאיפוס סיסמה", "שלחנו קישור לאיפוס הסיסמה לכתובת האימייל שהוזנה.");
    } catch {
      Alert.alert("שגיאה", "לא ניתן לשלוח מייל איפוס כרגע");
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ImageBackground source={OPEN_LOGO_BG} style={styles.bgImage} resizeMode="cover">
        <View style={styles.darkOverlay}>
          <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor={APP_BG} barStyle="light-content" />

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <ScrollView
                contentContainerStyle={[
                  styles.scrollContainer,
                  {
                    minHeight: height || 0,
                    paddingHorizontal: ui.horizontalPadding,
                    paddingTop: ui.topSpacer,
                    paddingBottom: Math.max(24, (height || 700) * 0.05),
                  },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={[styles.card, { maxWidth: ui.cardMaxWidth }]}>
                  <Text style={styles.label}>אימייל</Text>

                  <View style={styles.inputBox}>
                    <View style={styles.iconWrap}>
                      <MailIcon />
                    </View>

                    <TextInput
                      style={[styles.input, { fontSize: ui.inputFontSize }]}
                      placeholder="הזיני אימייל"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={setEmail}
                      textAlign="right"
                    />
                  </View>

                  <Text style={styles.label}>סיסמה</Text>

                  <View style={styles.inputBox}>
                    <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                      <View style={styles.iconWrap}>
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </View>
                    </TouchableOpacity>

                    <TextInput
                      style={[styles.input, { fontSize: ui.inputFontSize }]}
                      placeholder="הזיני סיסמה"
                      placeholderTextColor="#A1A1AA"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      textAlign="right"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={handleLogin}
                    />
                  </View>

                  <TouchableOpacity onPress={openForgotPasswordModal} style={styles.forgotPasswordButton}>
                    <Text style={styles.forgotPasswordText}>שכחתי סיסמה</Text>
                  </TouchableOpacity>

                  {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

                  <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>התחברות</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => router.push("/register")}>
                    <Text style={styles.signupText}>אין לך חשבון? להרשמה</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={resetModalVisible} transparent animationType="fade">
              <Pressable style={styles.modalOverlay} onPress={() => !isResetLoading && setResetModalVisible(false)}>
                <Pressable style={[styles.modalCard, { width: Math.min(width || 420, 420) - 32 }]} onPress={(e) => e.stopPropagation()}>
                  <Text style={styles.modalTitle}>איפוס סיסמה</Text>
                  <Text style={styles.modalSubtitle}>הזיני את כתובת האימייל שלך ונשלח אלייך קישור לאיפוס הסיסמה</Text>

                  <View style={styles.inputBox}>
                    <View style={styles.iconWrap}>
                      <MailIcon />
                    </View>

                    <TextInput
                      style={styles.input}
                      placeholder="הזיני אימייל"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      textAlign="right"
                    />
                  </View>

                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={() => setResetModalVisible(false)}>
                      <Text style={styles.modalCancelText}>ביטול</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.modalSendButton, isResetLoading && styles.buttonDisabled]} onPress={handleForgotPassword}>
                      {isResetLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalSendText}>שלחי קישור</Text>}
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: APP_BG,
  },
  darkOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  card: {
    width: "100%",
    alignSelf: "center",
    backgroundColor: "rgba(12,12,14,0.72)",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,122,0,0.35)",
  },
  label: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
    marginTop: 4,
  },
  inputBox: {
    width: "100%",
    minHeight: 56,
    borderWidth: 1,
    borderColor: "rgba(255,122,0,0.55)",
    borderRadius: 16,
    backgroundColor: "rgba(15,15,18,0.88)",
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 14,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    textAlign: "right",
    marginRight: 10,
    minHeight: 48,
    paddingVertical: Platform.OS === "android" ? 8 : 10,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    marginTop: -4,
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: "#FF8A1F",
    textAlign: "right",
    fontWeight: "800",
  },
  button: {
    width: "100%",
    minHeight: 56,
    backgroundColor: "#FF7A00",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  signupText: {
    color: "#FFB066",
    textAlign: "center",
    marginTop: 18,
    fontWeight: "800",
  },
  errorText: {
    color: "#FFB4B4",
    marginBottom: 6,
    textAlign: "right",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#17171C",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,122,0,0.35)",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#D4D4D8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
  },
  modalButtonsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3F3F46",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  modalSendButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#FF7A00",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSendText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});