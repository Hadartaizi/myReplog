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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../database/firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const APP_BG = '#F4F7FB';

const ADMIN_EMAIL = 'hadartaizi2002@gmail.com';

export default function Register() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const handleRegister = async () => {
    const newErrors: any = {};

    if (!name.trim()) newErrors.name = 'אנא הזיני שם';
    if (!email.trim()) newErrors.email = 'אנא הזיני אימייל';
    if (!password) newErrors.password = 'אנא הזיני סיסמה';
    if (!confirmPassword) newErrors.confirmPassword = 'אנא אשרי את הסיסמה';
    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות אינן תואמות';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setLoading(true);

      try {
        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );

        const user = userCredential.user;
        const role =
          trimmedEmail === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'client';

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: trimmedName,
          email: trimmedEmail,
          role,
          createdAt: new Date().toISOString(),
        });

        setLoading(false);
        router.push('/');
      } catch (error: any) {
        setLoading(false);
        console.error('שגיאה בהרשמה:', error);

        if (error.code === 'auth/email-already-in-use') {
          setErrors({ email: 'כתובת המייל כבר רשומה במערכת' });
        } else if (error.code === 'auth/invalid-email') {
          setErrors({ email: 'כתובת מייל לא תקינה' });
        } else if (error.code === 'auth/weak-password') {
          setErrors({ password: 'הסיסמה חלשה מדי' });
        } else {
          setErrors({ general: 'אירעה שגיאה בהרשמה, אנא נסי שוב' });
        }
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar backgroundColor={APP_BG} barStyle="dark-content" />

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
            <View style={styles.topSection}>
              <Text style={styles.title}>הרשמה</Text>
              <Text style={styles.subtitle}>
                צרי חשבון חדש והתחילי לנהל את האימונים שלך בצורה מסודרת
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>שם</Text>
              <View style={styles.inputBox}>
                <MaterialIcons name="person-outline" size={20} color="#5B6470" />
                <TextInput
                  style={styles.input}
                  placeholder="הזיני שם"
                  placeholderTextColor="#8A94A6"
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
                  textAlign="right"
                />
              </View>
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

              <Text style={styles.label}>אימייל</Text>
              <View style={styles.inputBox}>
                <MaterialIcons name="mail-outline" size={20} color="#5B6470" />
                <TextInput
                  style={styles.input}
                  placeholder="הזיני אימייל"
                  placeholderTextColor="#8A94A6"
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
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color="#5B6470"
                  />
                </TouchableOpacity>

                <TextInput
                  style={styles.input}
                  placeholder="הזיני סיסמה"
                  placeholderTextColor="#8A94A6"
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
                  <MaterialIcons
                    name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color="#5B6470"
                  />
                </TouchableOpacity>

                <TextInput
                  style={styles.input}
                  placeholder="הזיני שוב את הסיסמה"
                  placeholderTextColor="#8A94A6"
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
          </ScrollView>
        </KeyboardAvoidingView>
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
    paddingHorizontal: screenWidth * 0.07,
    paddingTop: screenHeight * 0.08,
    paddingBottom: screenHeight * 0.05,
  },

  topSection: {
    alignItems: 'center',
    marginBottom: screenHeight * 0.045,
  },

  title: {
    fontSize: screenWidth * 0.12,
    fontFamily: 'Bilbo',
    color: '#1E293B',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: screenWidth < 380 ? 14 : 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
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
    fontSize: screenWidth < 380 ? 14 : 15,
  },

  inputBox: {
    width: '100%',
    minHeight: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D7DFE9',
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  input: {
    flex: 1,
    fontSize: screenWidth < 380 ? 14 : 16,
    color: '#111827',
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
    backgroundColor: '#0F172A',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
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
    fontSize: screenWidth < 380 ? 15 : 16,
    fontWeight: '800',
  },

  loginLink: {
    color: '#1D4ED8',
    fontSize: screenWidth < 380 ? 14 : 15,
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '700',
  },

  errorText: {
    color: '#DC2626',
    fontSize: screenWidth < 380 ? 13 : 14,
    textAlign: 'right',
    fontWeight: '500',
    marginBottom: 4,
    marginTop: -2,
  },
});