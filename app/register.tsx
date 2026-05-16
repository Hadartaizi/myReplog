import React, { useState } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  Dimensions,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  setPersistence,
  signOut,
} from 'firebase/auth';
import { auth } from '../database/firebase.js';
import { completeClientSignupAfterAuth } from './utils/completeClientSignupAfterAuth';
import Svg, { Path, Circle } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const APP_BG = '#0B0B0D';
const CARD_BG = '#17171C';
const INPUT_BG = '#111114';
const BORDER = '#2F2F35';
const ORANGE = '#FF7A00';
const ORANGE_DARK = '#E85D00';
const TEXT = '#FFFFFF';
const MUTED = '#B8B8B8';
const ICON = '#C8CDD3';
const ERROR = '#FF4D4D';

const OWNER_EMAIL = 'hadartaizi2002@gmail.com';

function PersonIcon({ size = 20, color = ICON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" fill="none" />
      <Path
        d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MailIcon({ size = 20, color = ICON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M4 8l8 6 8-6"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EyeIcon({ size = 20, color = ICON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

function EyeOffIcon({ size = 20, color = ICON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 3l18 18" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path
        d="M10.6 6.3A11.4 11.4 0 0 1 12 6c6.5 0 10 6 10 6a17.4 17.4 0 0 1-3.2 3.9"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.7 6.8C3.8 8.5 2 12 2 12s3.5 6 10 6a10.7 10.7 0 0 0 4.2-.8"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

export default function Register() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const showErrorAlert = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('שגיאה', message);
    }
  };

  const showSuccessAlert = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('הצלחה', message);
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) newErrors.name = 'אנא הזיני שם';
    if (!trimmedEmail) newErrors.email = 'אנא הזיני אימייל';
    if (!password) newErrors.password = 'אנא הזיני סיסמה';
    if (!confirmPassword) newErrors.confirmPassword = 'אנא אשרי את הסיסמה';

    if (password && password.length < 6) {
      newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }

    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות אינן תואמות';
    }

    setErrors(newErrors);

    return {
      isValid: Object.keys(newErrors).length === 0,
      trimmedName,
      trimmedEmail,
    };
  };

  const handleRegister = async () => {
    const { isValid, trimmedName, trimmedEmail } = validateForm();
    if (!isValid) return;

    setLoading(true);
    setErrors({});

    let createdAuthUser: any = null;

    try {
      if (Platform.OS === 'web') {
        await setPersistence(auth, browserSessionPersistence);
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      createdAuthUser = userCredential.user;

      const isOwner = trimmedEmail === OWNER_EMAIL.toLowerCase();

      if (isOwner) {
        await completeClientSignupAfterAuth({
          authUid: createdAuthUser.uid,
          email: trimmedEmail,
          fallbackName: trimmedName,
        });

        showSuccessAlert('ההרשמה בוצעה בהצלחה');
        router.replace('/');
        return;
      }

      const result = await completeClientSignupAfterAuth({
        authUid: createdAuthUser.uid,
        email: trimmedEmail,
        fallbackName: trimmedName,
      });

      await signOut(auth);

      if (result.matchedInvite) {
        showSuccessAlert('ההרשמה הושלמה בהצלחה. עכשיו אפשר להתחבר למערכת');
      } else {
        showSuccessAlert(
          'ההרשמה בוצעה, אך לא נמצאה הזמנה פעילה. יש להמתין לאישור מנהל המערכת'
        );
      }

      router.replace('/');
    } catch (error: any) {
      console.error('שגיאה בהרשמה:', error);

      if (
        createdAuthUser &&
        error?.code !== 'auth/email-already-in-use' &&
        error?.code !== 'auth/invalid-email' &&
        error?.code !== 'auth/weak-password'
      ) {
        try {
          await deleteUser(createdAuthUser);
        } catch (deleteError) {
          console.error('שגיאה במחיקת משתמש Auth אחרי כשל בשמירה:', deleteError);
        }
      }

      if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'כתובת המייל כבר רשומה במערכת' });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'כתובת מייל לא תקינה' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ password: 'הסיסמה חלשה מדי' });
      } else if (
        error.code === 'permission-denied' ||
        error.code === 'firestore/permission-denied'
      ) {
        setErrors({ general: 'אין הרשאה לשמור את המשתמש בבסיס הנתונים' });
        showErrorAlert(
          'המשתמש נוצר אך השמירה למסד הנתונים נחסמה. צריך לבדוק את חוקי Firestore.'
        );
      } else {
        setErrors({ general: 'אירעה שגיאה בהרשמה, אנא נסי שוב' });
        showErrorAlert('אירעה שגיאה בהרשמה, אנא נסי שוב');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar backgroundColor={APP_BG} barStyle="light-content" />

      <View style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.screen}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.topSection}>
                <Text style={styles.title}>הרשמה</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>שם</Text>
                <View style={styles.inputBox}>
                  <View style={styles.iconWrap}>
                    <PersonIcon />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="הזיני שם"
                    placeholderTextColor="#77777D"
                    value={name}
                    onChangeText={setName}
                    editable={!loading}
                    textAlign="right"
                  />
                </View>
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

                <Text style={styles.label}>אימייל</Text>
                <View style={styles.inputBox}>
                  <View style={styles.iconWrap}>
                    <MailIcon />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="הזיני אימייל"
                    placeholderTextColor="#77777D"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    editable={!loading}
                    textAlign="right"
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

                <Text style={styles.label}>סיסמה</Text>
                <View style={styles.inputBox}>
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.iconPressable}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrap}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </View>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.input}
                    placeholder="הזיני סיסמה"
                    placeholderTextColor="#77777D"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                    textAlign="right"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

                <Text style={styles.label}>אישור סיסמה</Text>
                <View style={styles.inputBox}>
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    style={styles.iconPressable}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconWrap}>
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </View>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.input}
                    placeholder="הזיני שוב את הסיסמה"
                    placeholderTextColor="#77777D"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    editable={!loading}
                    textAlign="right"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.confirmPassword ? (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                ) : null}

                {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>הרשמה</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity disabled={loading} onPress={() => router.push('/')}>
                  <Text style={styles.loginLink}>יש לך כבר חשבון? התחברות</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: screenWidth * 0.06,
    paddingTop: screenHeight * 0.06,
    paddingBottom: screenHeight * 0.05,
  },

  card: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: screenWidth < 380 ? 18 : 22,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 7,
  },

  topSection: {
    alignItems: 'center',
    marginBottom: screenHeight * 0.035,
  },

  logoText: {
    color: ORANGE,
    fontSize: screenWidth < 380 ? 28 : 34,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },

  title: {
    fontSize: screenWidth < 380 ? 22 : 27,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: screenWidth < 380 ? 14 : 15,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  formSection: {
    width: '100%',
  },

  label: {
    color: '#EDEDED',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
    marginTop: 4,
    fontSize: screenWidth < 380 ? 14 : 15,
  },

  inputBox: {
    width: '100%',
    minHeight: 54,
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },

  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    fontSize: screenWidth < 380 ? 14 : 16,
    color: TEXT,
    textAlign: 'right',
    marginRight: 10,
    minHeight: 44,
  },

  iconPressable: {
    paddingLeft: 4,
    paddingVertical: 4,
  },

  button: {
    width: '100%',
    minHeight: 54,
    backgroundColor: ORANGE,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },

  buttonDisabled: {
    backgroundColor: ORANGE_DARK,
    opacity: 0.75,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: screenWidth < 380 ? 15 : 16,
    fontWeight: '800',
  },

  loginLink: {
    color: ORANGE,
    fontSize: screenWidth < 380 ? 14 : 15,
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '700',
  },

  errorText: {
    color: ERROR,
    fontSize: screenWidth < 380 ? 13 : 14,
    textAlign: 'right',
    fontWeight: '500',
    marginBottom: 4,
    marginTop: -2,
  },
});