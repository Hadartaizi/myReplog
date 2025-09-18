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
} from 'react-native';

import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../database/firebase.js';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ 'Bilbo': require('../assets/fonts/Bilbo-Regular.ttf') });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!fontsLoaded) return null;

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password) {
      setErrorMessage('אנא הזן אימייל וסיסמה');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push('/home');
    } catch (error) {
      console.log('שגיאה בכניסה:', error);
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setErrorMessage('אימייל או סיסמה שגויים');
          break;
        case 'auth/invalid-email':
          setErrorMessage('כתובת האימייל אינה תקינה');
          break;
        default:
          setErrorMessage('אירעה שגיאה, אנא נסי שוב');
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 20} // כאן מווסתים את המרחק מהמקלדת
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <StatusBar backgroundColor="#AEC6CF" barStyle="dark-content" />
            <Image
              source={require('../assets/images/myAppImg/logoBarbells.png')}
              style={styles.logo}
            />
            <Text style={styles.titleReplog}>REPLOG</Text>

            <TextInput
              style={styles.input}
              placeholder="אימייל"
              placeholderTextColor="#9DA3AA"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              textAlign="right"
              writingDirection="rtl"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="סיסמא"
                placeholderTextColor="#9DA3AA"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                textAlign="right"
                writingDirection="rtl"
              />
              <TouchableOpacity onPress={() => setShowPassword(prev => !prev)}>
                <Image
                  source={
                    showPassword
                      ? require('../assets/images/myAppImg/openEye.png')
                      : require('../assets/images/myAppImg/closeEye.png')
                  }
                  style={styles.eyeIcon}
                />
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>התחברות</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.signupText}>הרשמה</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#AEC6CF',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: screenHeight * 0.15,
    paddingHorizontal: screenWidth * 0.05,
  },
  logo: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.12,
    resizeMode: 'contain',
    marginBottom: screenHeight * 0.05,
  },
  titleReplog: {
    fontSize: screenWidth * 0.12,
    fontFamily: 'Bilbo',
    marginBottom: screenHeight * 0.06,
  },
  input: {
    width: '90%',
    backgroundColor: '#D9D9D9',
    borderRadius: screenWidth * 0.02,
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.015, // Padding אנכי דינמי
    fontSize: screenWidth * 0.045,
    marginBottom: screenHeight * 0.02,
    textAlign: 'right',
    writingDirection: 'rtl',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    color: '#000',
  },
  passwordContainer: {
    width: '90%',
    backgroundColor: '#D9D9D9',
    borderRadius: screenWidth * 0.02,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.015, // Padding אנכי דינמי
    marginBottom: screenHeight * 0.02,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  passwordInput: {
    flex: 1,
    fontSize: screenWidth * 0.045,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: '#000',
    paddingVertical: 0, // נמנע padding כפול
  },
  eyeIcon: {
    width: screenWidth * 0.07,
    height: screenWidth * 0.07,
    resizeMode: 'contain',
    marginLeft: screenWidth * 0.02,
  },
  button: {
    width: screenWidth * 0.35,
    height: screenHeight * 0.06,
    backgroundColor: '#8A8484',
    borderRadius: screenWidth * 0.05,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: screenHeight * 0.03,
  },
  buttonText: {
    color: '#fff',
    fontSize: screenWidth * 0.045,
  },
  signupText: {
    color: 'black',
    fontSize: screenWidth * 0.04,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: 'red',
    fontSize: screenWidth * 0.035,
    marginBottom: screenHeight * 0.01,
    alignSelf: 'flex-start',
    width: '90%',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

