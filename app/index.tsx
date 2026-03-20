import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StatusBar,
  StyleSheet,
  Dimensions,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../database/firebase.js';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const APP_BG = '#F4F7FB';

export default function Index() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar backgroundColor={APP_BG} barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topSection}>
              <Image
                source={require('../assets/images/myAppImg/logoBarbells.png')}
                style={styles.logo}
              />

              <Text style={styles.titleReplog}>REPLOG</Text>

              <Text style={styles.welcomeTitle}>ברוכה הבאה</Text>
              <Text style={styles.subtitle}>
                התחבר/י כדי להמשיך לנהל ולעקוב אחרי האימונים שלך
              </Text>
            </View>

            <View style={styles.formSection}>
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
                  textAlign="right"
                />
              </View>

              <Text style={styles.label}>סיסמה</Text>
              <View style={styles.inputBox}>
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.iconPressable}
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
                  textAlign="right"
                />
              </View>

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>התחברות</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.signupText}>אין לך חשבון? להרשמה</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    marginBottom: screenHeight * 0.05,
  },

  logo: {
    width: screenWidth * 0.72,
    height: screenHeight * 0.12,
    resizeMode: 'contain',
    marginBottom: 6,
  },

  titleReplog: {
    fontSize: screenWidth * 0.12,
    fontFamily: 'Bilbo',
    color: '#1E293B',
    marginBottom: 12,
  },

  welcomeTitle: {
    fontSize: screenWidth < 380 ? 24 : 28,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: screenWidth < 380 ? 14 : 15,
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
    fontSize: screenWidth < 380 ? 14 : 15,
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
    fontSize: screenWidth < 380 ? 14 : 16,
    textAlign: 'right',
    marginRight: 10,
  },

  iconPressable: {
    paddingLeft: 4,
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
    fontSize: screenWidth < 380 ? 15 : 16,
    fontWeight: '800',
  },

  signupText: {
    color: '#1D4ED8',
    fontSize: screenWidth < 380 ? 14 : 15,
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '700',
  },

  errorText: {
    color: '#DC2626',
    fontSize: screenWidth < 380 ? 13 : 14,
    marginTop: -2,
    marginBottom: 6,
    textAlign: 'right',
    fontWeight: '500',
  },
});