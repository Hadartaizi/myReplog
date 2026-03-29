import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { auth, db } from '../database/firebase.js';
import { getAccessState } from './components/admin/accessUtils';

const APP_BG = '#aec6cfb7';

function MailIcon({ size = 22, color = '#5B6470' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M4 8l8 6 8-6"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EyeIcon({ size = 22, color = '#5B6470' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

function EyeOffIcon({ size = 22, color = '#5B6470' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Line
        x1="4"
        y1="4"
        x2="20"
        y2="20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function Index() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);

  const ui = useMemo(() => {
    const safeWidth = Math.min(width, 430);
    const isSmallScreen = safeWidth < 360;
    const isTablet = width >= 768;

    return {
      isSmallScreen,
      isTablet,
      horizontalPadding: isTablet ? 32 : safeWidth < 380 ? 18 : 24,
      cardMaxWidth: isTablet ? 520 : 460,
      logoWidth: Math.min(safeWidth * 0.72, isTablet ? 360 : 300),
      logoHeight: isSmallScreen ? 92 : isTablet ? 132 : 112,
      titleFontSize: isSmallScreen ? 58 : isTablet ? 84 : 74,
      welcomeFontSize: isSmallScreen ? 26 : isTablet ? 34 : 31,
      subtitleFontSize: isSmallScreen ? 15 : 17,
      inputFontSize: isSmallScreen ? 14 : 16,
      buttonFontSize: isSmallScreen ? 15 : 16,
    };
  }, [width]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setErrorMessage('אנא הזיני אימייל וסיסמה');
      return;
    }

    try {
      setIsLoading(true);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await signOut(auth);
        setErrorMessage('לא נמצאו פרטי משתמש. יש להתחבר מחדש');
        return;
      }

      const userData = userSnap.data();
      const accessState = getAccessState(userData);

      if (!accessState.allowed) {
        await signOut(auth);

        switch (accessState.reason) {
          case 'blocked':
            setErrorMessage('החשבון שלך נחסם');
            showMessage(
              'החשבון חסום',
              'הגישה שלך למערכת נחסמה. יש לפנות למנהל המערכת.'
            );
            return;

          case 'pending_approval':
            setErrorMessage('החשבון עדיין ממתין לאישור מנהל');
            showMessage(
              'החשבון ממתין לאישור',
              'עדיין אין לך הרשאת גישה למערכת. יש להמתין לאישור מנהל.'
            );
            return;

          case 'expired':
            setErrorMessage('תקופת הגישה שלך הסתיימה');
            showMessage(
              'הגישה הסתיימה',
              'תקופת הגישה שהוגדרה עבורך הסתיימה.'
            );
            return;

          case 'missing_access_end':
          case 'invalid_access_end':
            setErrorMessage('לא הוגדרה תקופת גישה תקינה לחשבון');
            showMessage(
              'אין גישה למערכת',
              'לא הוגדרה עבורך תקופת גישה תקינה. יש לפנות למנהל המערכת.'
            );
            return;

          case 'missing_user_doc':
            setErrorMessage('לא נמצאו פרטי משתמש');
            showMessage('שגיאה', 'לא נמצאו פרטי משתמש. יש לנסות שוב.');
            return;

          case 'not_approved':
          default:
            setErrorMessage('אין כרגע הרשאת גישה למערכת');
            showMessage('אין גישה למערכת', 'אין כרגע הרשאת גישה למערכת.');
            return;
        }
      }

      router.replace('/home');
    } catch (error: any) {
      console.log('שגיאה בכניסה:', error);

      switch (error?.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setErrorMessage('אימייל או סיסמה שגויים');
          break;
        case 'auth/invalid-email':
          setErrorMessage('כתובת האימייל אינה תקינה');
          break;
        case 'auth/too-many-requests':
          setErrorMessage('בוצעו יותר מדי ניסיונות. נסי שוב מאוחר יותר');
          break;
        default:
          setErrorMessage('אירעה שגיאה, אנא נסי שוב');
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
      Alert.alert('חסר אימייל', 'אנא הזיני כתובת אימייל');
      return;
    }

    try {
      setIsResetLoading(true);
      auth.languageCode = 'he';

      await sendPasswordResetEmail(auth, trimmedEmail);

      setResetModalVisible(false);
      setEmail(trimmedEmail);

      Alert.alert(
        'נשלח מייל לאיפוס סיסמה',
        'שלחנו קישור לאיפוס הסיסמה לכתובת האימייל שהוזנה. בדקי גם בתיקיית הספאם.'
      );
    } catch (error: any) {
      console.log('שגיאה באיפוס סיסמה:', error);

      switch (error?.code) {
        case 'auth/invalid-email':
          Alert.alert('שגיאה', 'כתובת האימייל אינה תקינה');
          break;
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          Alert.alert('שגיאה', 'לא נמצא משתמש עם כתובת האימייל הזו');
          break;
        case 'auth/too-many-requests':
          Alert.alert('שגיאה', 'בוצעו יותר מדי ניסיונות. נסי שוב מאוחר יותר');
          break;
        default:
          Alert.alert('שגיאה', 'לא ניתן לשלוח מייל איפוס כרגע');
      }
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor={APP_BG} barStyle="dark-content" />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContainer,
              {
                minHeight: height,
                paddingHorizontal: ui.horizontalPadding,
                paddingTop: Math.max(24, height * 0.04),
                paddingBottom: Math.max(24, height * 0.05),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.card, { maxWidth: ui.cardMaxWidth }]}>
              <View
                style={[
                  styles.topSection,
                  { marginBottom: ui.isSmallScreen ? 28 : 36 },
                ]}
              >
                <Image
                  source={require('../assets/images/myAppImg/logoBarbells.png')}
                  resizeMode="contain"
                  style={[
                    styles.logo,
                    {
                      width: ui.logoWidth,
                      height: ui.logoHeight,
                    },
                  ]}
                />

                <Text
                  allowFontScaling={false}
                  style={[
                    styles.titleReplog,
                    {
                      fontSize: ui.titleFontSize,
                      lineHeight: ui.titleFontSize,
                    },
                  ]}
                >
                  REPLOG
                </Text>

                <Text
                  allowFontScaling={false}
                  style={[
                    styles.welcomeTitle,
                    { fontSize: ui.welcomeFontSize },
                  ]}
                >
                  ברוכה הבאה
                </Text>

                <Text
                  allowFontScaling={false}
                  style={[
                    styles.subtitle,
                    {
                      fontSize: ui.subtitleFontSize,
                      lineHeight: ui.subtitleFontSize + 8,
                    },
                  ]}
                >
                  התחבר/י כדי להמשיך לנהל ולעקוב אחרי האימונים שלך
                </Text>
              </View>

              <View style={styles.formSection}>
                <Text
                  allowFontScaling={false}
                  style={[styles.label, { fontSize: ui.subtitleFontSize + 1 }]}
                >
                  אימייל
                </Text>

                <View style={styles.inputBox}>
                  <View style={styles.iconWrap}>
                    <MailIcon size={22} color="#5B6470" />
                  </View>

                  <TextInput
                    style={[styles.input, { fontSize: ui.inputFontSize }]}
                    placeholder="הזיני אימייל"
                    placeholderTextColor="#8A94A6"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    textAlign="right"
                    returnKeyType="next"
                  />
                </View>

                <Text
                  allowFontScaling={false}
                  style={[styles.label, { fontSize: ui.subtitleFontSize + 1 }]}
                >
                  סיסמה
                </Text>

                <View style={styles.inputBox}>
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.iconPressable}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrap}>
                      {showPassword ? (
                        <EyeOffIcon size={22} color="#5B6470" />
                      ) : (
                        <EyeIcon size={22} color="#5B6470" />
                      )}
                    </View>
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.input, { fontSize: ui.inputFontSize }]}
                    placeholder="הזיני סיסמה"
                    placeholderTextColor="#8A94A6"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    textAlign="right"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleLogin}
                    returnKeyType="done"
                  />
                </View>

                <TouchableOpacity
                  onPress={openForgotPasswordModal}
                  activeOpacity={0.7}
                  style={styles.forgotPasswordButton}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.forgotPasswordText,
                      { fontSize: ui.isSmallScreen ? 13 : 14 },
                    ]}
                  >
                    שכחתי סיסמה
                  </Text>
                </TouchableOpacity>

                {!!errorMessage && (
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.errorText,
                      { fontSize: ui.isSmallScreen ? 13 : 14 },
                    ]}
                  >
                    {errorMessage}
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.buttonText,
                        { fontSize: ui.buttonFontSize },
                      ]}
                    >
                      התחברות
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/register')}
                  activeOpacity={0.8}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.signupText,
                      { fontSize: ui.isSmallScreen ? 14 : 15 },
                    ]}
                  >
                    אין לך חשבון? להרשמה
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={resetModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setResetModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (!isResetLoading) {
                setResetModalVisible(false);
              }
            }}
          >
            <Pressable
              style={[
                styles.modalCard,
                { width: Math.min(width - 32, 420) },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text allowFontScaling={false} style={styles.modalTitle}>
                איפוס סיסמה
              </Text>

              <Text allowFontScaling={false} style={styles.modalSubtitle}>
                הזיני את כתובת האימייל שלך ונשלח אלייך קישור לאיפוס הסיסמה
              </Text>

              <View style={styles.modalInputBox}>
                <View style={styles.iconWrap}>
                  <MailIcon size={22} color="#5B6470" />
                </View>

                <TextInput
                  style={styles.modalInput}
                  placeholder="הזיני אימייל"
                  placeholderTextColor="#8A94A6"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  textAlign="right"
                  editable={!isResetLoading}
                />
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setResetModalVisible(false)}
                  disabled={isResetLoading}
                  activeOpacity={0.8}
                >
                  <Text allowFontScaling={false} style={styles.modalCancelText}>
                    ביטול
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSendButton,
                    isResetLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleForgotPassword}
                  disabled={isResetLoading}
                  activeOpacity={0.8}
                >
                  {isResetLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text allowFontScaling={false} style={styles.modalSendText}>
                      שלחי קישור
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  flex: {
    flex: 1,
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    width: '100%',
    alignSelf: 'center',
  },

  topSection: {
    alignItems: 'center',
  },

  logo: {
    marginBottom: 8,
  },

  titleReplog: {
    fontFamily: 'Bilbo',
    color: '#1E293B',
    marginBottom: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },

  welcomeTitle: {
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 8,
    maxWidth: 420,
    fontWeight: '500',
  },

  formSection: {
    width: '100%',
  },

  label: {
    color: '#334155',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
    marginTop: 4,
  },

  inputBox: {
    width: '100%',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#D7DFE9',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: Platform.OS === 'android' ? 2 : 0,
  },

  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    color: '#111827',
    textAlign: 'right',
    marginRight: 10,
    minHeight: 48,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
  },

  iconPressable: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    marginTop: -4,
    marginBottom: 10,
  },

  forgotPasswordText: {
    color: '#2563EB',
    textAlign: 'right',
    fontWeight: '700',
  },

  button: {
    width: '100%',
    minHeight: 56,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 4 : 0,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  signupText: {
    color: '#1D4ED8',
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '700',
  },

  errorText: {
    color: '#DC2626',
    marginTop: -2,
    marginBottom: 6,
    textAlign: 'right',
    fontWeight: '500',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 10,
  },

  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },

  modalInputBox: {
    width: '100%',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#D7DFE9',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 18,
  },

  modalInput: {
    flex: 1,
    color: '#111827',
    textAlign: 'right',
    marginRight: 10,
    minHeight: 48,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    fontSize: 15,
  },

  modalButtonsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
  },

  modalCancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },

  modalCancelText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 15,
  },

  modalSendButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },

  modalSendText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});