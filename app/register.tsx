import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Dimensions,
  StatusBar, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';

import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';

import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from '../database/firebase.js';
import { doc, setDoc } from "firebase/firestore";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Register() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    'Bilbo': require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) return null;

  const handleRegister = async () => {
    const newErrors = {};

    if (!name.trim()) newErrors.name = 'אנא הזן שם';
    if (!email.trim()) newErrors.email = 'אנא הזן אימייל';
    if (!password) newErrors.password = 'אנא הזן סיסמה';
    if (!confirmPassword) newErrors.confirmPassword = 'אנא אשר את הסיסמה';
    if (password && confirmPassword && password !== confirmPassword)
      newErrors.confirmPassword = 'הסיסמאות אינן תואמות';

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setLoading(true);
      try {
        console.log('שם שהוזן:', name);

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log('נשמר ל־Firestore עם שם:', name);

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name.trim(),
          email: email.trim(),
          createdAt: new Date(),
        });

        setLoading(false);
        router.push('/');
      } catch (error) {
        setLoading(false);
        console.error('שגיאה בהרשמה:', error);
        if (error.code === 'auth/email-already-in-use') {
          setErrors({ email: 'כתובת המייל כבר רשומה במערכת' });
        } else if (error.code === 'auth/invalid-email') {
          setErrors({ email: 'כתובת מייל לא תקינה' });
        } else if (error.code === 'auth/weak-password') {
          setErrors({ password: 'הסיסמה חלשה מדי' });
        } else {
          alert('אירעה שגיאה בהרשמה, אנא נסי שוב מאוחר יותר');
        }
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <StatusBar backgroundColor="#AEC6CF" barStyle="dark-content" />
            <Text style={styles.title}>הרשמה</Text>

            {/* שדה שם */}
            <TextInput
              style={styles.input}
              placeholder="שם"
              placeholderTextColor="#9DA3AA"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            {/* אימייל */}
            <TextInput
              style={styles.input}
              placeholder="אימייל"
              placeholderTextColor="#9DA3AA"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            {/* סיסמה */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="סיסמה"
                placeholderTextColor="#9DA3AA"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
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
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            {/* אישור סיסמה */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="אישור סיסמה"
                placeholderTextColor="#9DA3AA"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(prev => !prev)}>
                <Image
                  source={
                    showConfirmPassword
                      ? require('../assets/images/myAppImg/openEye.png')
                      : require('../assets/images/myAppImg/closeEye.png')
                  }
                  style={styles.eyeIcon}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

            <TouchableOpacity
              style={[styles.button, loading && { backgroundColor: '#bbb' }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'רק רגע...' : 'הרשמה'}</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={loading} onPress={() => router.push('/')}>
              <Text style={styles.loginLink}>יש לך כבר חשבון? התחברות</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#AEC6CF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
  },
  title: {
    fontSize: screenWidth * 0.1,
    fontFamily: 'Bilbo',
    marginBottom: screenHeight * 0.04,
  },
  input: {
    width: '90%',
    height: screenHeight * 0.065,
    backgroundColor: '#D9D9D9',
    borderRadius: screenWidth * 0.02,
    paddingHorizontal: screenWidth * 0.04,
    fontSize: screenWidth * 0.045,
    marginBottom: screenHeight * 0.01,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: '#000',
  },
  passwordContainer: {
    width: '90%',
    height: screenHeight * 0.065,
    backgroundColor: '#D9D9D9',
    borderRadius: screenWidth * 0.02,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.04,
    marginBottom: screenHeight * 0.01,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  passwordInput: {
    flex: 1,
    fontSize: screenWidth * 0.045,
    color: '#000',
    textAlign: 'right',
    writingDirection: 'rtl',
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
    marginTop: screenHeight * 0.02,
    marginBottom: screenHeight * 0.02,
  },
  buttonText: {
    color: '#fff',
    fontSize: screenWidth * 0.045,
  },
  loginLink: {
    color: 'black',
    fontSize: screenWidth * 0.04,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: 'red',
    fontSize: screenWidth * 0.035,
    alignSelf: 'flex-end',
    marginRight: screenWidth * 0.06,
    marginBottom: screenHeight * 0.005,
  },
});
