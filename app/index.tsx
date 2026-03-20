import React, { useState } from 'react';
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../database/firebase.js';

const APP_BG = '#F4F7FB';

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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const handleLogin = async () => {
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('אנא הזיני אימייל וסיסמה');
      return;
    }

    try {
      setIsLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push('/home');
    } catch (error: any) {
      console.log('שגיאה בכניסה:', error);

      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setErrorMessage('אימייל או סיסמה שגויים');
          break;
        case 'auth/invalid-email':
          setErrorMessage('כתובת האימייל אינה תקינה');
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

      // אפשר גם להגדיר שפה:
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

      switch (error.code) {
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
          Alert.alert('שגיאה', `לא ניתן לשלוח מייל איפוס כרגע: ${error.code || ''}`);
      }
    } finally {
      setIsResetLoading(false);
    }
  };

  const isSmallScreen = width < 380;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar backgroundColor={APP_BG} barStyle="dark-content" />

      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.container,
              {
                paddingHorizontal: width * 0.07,
                paddingTop: height * 0.06,
                paddingBottom: height * 0.05,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.card, { maxWidth: 460 }]}>
              <View style={[styles.topSection, { marginBottom: height * 0.04 }]}>
                <Image
                  source={require('../assets/images/myAppImg/logoBarbells.png')}
                  resizeMode="contain"
                  style={[
                    styles.logo,
                    {
                      width: Math.min(width * 0.85, 340),
                      height: isSmallScreen ? 95 : 125,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.titleReplog,
                    { fontSize: isSmallScreen ? 54 : 68 },
                  ]}
                >
                  REPLOG
                </Text>

                <Text
                  style={[
                    styles.welcomeTitle,
                    { fontSize: isSmallScreen ? 24 : 28 },
                  ]}
                >
                  ברוכה הבאה
                </Text>

                <Text
                  style={[
                    styles.subtitle,
                    { fontSize: isSmallScreen ? 14 : 15 },
                  ]}
                >
                  התחבר/י כדי להמשיך לנהל ולעקוב אחרי האימונים שלך
                </Text>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, { fontSize: isSmallScreen ? 14 : 15 }]}>
                  אימייל
                </Text>

                <View style={styles.inputBox}>
                  <MaterialIcons name="mail-outline" size={20} color="#5B6470" />
                  <TextInput
                    style={[styles.input, { fontSize: isSmallScreen ? 14 : 16 }]}
                    placeholder="הזיני אימייל"
                    placeholderTextColor="#8A94A6"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    textAlign="right"
                  />
                </View>

                <Text style={[styles.label, { fontSize: isSmallScreen ? 14 : 15 }]}>
                  סיסמה
                </Text>

                <View style={styles.inputBox}>
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.iconPressable}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color="#5B6470"
                    />
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.input, { fontSize: isSmallScreen ? 14 : 16 }]}
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
                    style={[
                      styles.forgotPasswordText,
                      { fontSize: isSmallScreen ? 13 : 14 },
                    ]}
                  >
                    שכחתי סיסמה
                  </Text>
                </TouchableOpacity>

                {errorMessage ? (
                  <Text
                    style={[
                      styles.errorText,
                      { fontSize: isSmallScreen ? 13 : 14 },
                    ]}
                  >
                    {errorMessage}
                  </Text>
                ) : null}

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
                      style={[
                        styles.buttonText,
                        { fontSize: isSmallScreen ? 15 : 16 },
                      ]}
                    >
                      התחברות
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/register')}>
                  <Text
                    style={[
                      styles.signupText,
                      { fontSize: isSmallScreen ? 14 : 15 },
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
              style={styles.modalCard}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.modalTitle}>איפוס סיסמה</Text>

              <Text style={styles.modalSubtitle}>
                הזיני את כתובת האימייל שלך ונשלח אלייך קישור לאיפוס הסיסמה
              </Text>

              <View style={styles.modalInputBox}>
                <MaterialIcons name="mail-outline" size={20} color="#5B6470" />
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
                  <Text style={styles.modalCancelText}>ביטול</Text>
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
                    <Text style={styles.modalSendText}>שלחי קישור</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#aec6cfb7',
  },

  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    width: '100%',
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
    marginBottom: 10,
    lineHeight: 72,
  },

  welcomeTitle: {
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
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
    minHeight: 54,
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
    elevation: 2,
  },

  input: {
    flex: 1,
    color: '#111827',
    textAlign: 'right',
    marginRight: 10,
    minHeight: 44,
  },

  iconPressable: {
    paddingLeft: 4,
    paddingVertical: 4,
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
    minHeight: 54,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
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
    paddingHorizontal: 24,
  },

  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
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
    minHeight: 54,
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
    minHeight: 44,
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
  },

  modalSendText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});