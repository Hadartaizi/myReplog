import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Alert,
  View,
  ScrollView,
  Share,
  Modal,
  Switch,
} from 'react-native';
import AppLayout from './components/AppLayout';
import { useFonts } from 'expo-font';
import { auth } from '../database/firebase';
import { router } from 'expo-router';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Menu() {
  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [screen, setScreen] = useState<'menu' | 'privacy' | 'accessibility'>('menu');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isEnglish, setIsEnglish] = useState(false);
  const [textScale, setTextScale] = useState(1); // 1 = רגיל, 1.2 = בינוני, 1.5 = גדול

  if (!fontsLoaded) return null;

  const shareMyProfile = async () => {
    const defaultAppLink = 'https://expo.dev/accounts/hadartaizi/projects/repLog';
    const message = `🔥 תבדקו את האפליקציה שלנו! הורידו כאן:\n${defaultAppLink}`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בעת שיתוף הקישור');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/'); // ניתוב למסך כניסה או בית
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה בעיה בהתנתקות');
    }
  };

  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Pressable
        style={styles.menuItem}
        onPress={() => setSettingsVisible(true)}
        android_ripple={{ color: '#ddd' }}
      >
        <Text style={[styles.menuText, { fontSize: screenWidth * 0.045 * textScale }]}>
          ⚙️ {isEnglish ? 'Settings' : 'הגדרות'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.menuItem}
        onPress={shareMyProfile}
        android_ripple={{ color: '#ddd' }}
      >
        <Text style={[styles.menuText, { fontSize: screenWidth * 0.045 * textScale }]}>
          📎 {isEnglish ? 'Share App' : 'שיתוף האפליקציה'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.menuItem}
        onPress={() => setScreen('privacy')}
        android_ripple={{ color: '#ddd' }}
      >
        <Text style={[styles.menuText, { fontSize: screenWidth * 0.045 * textScale }]}>
          🔒 {isEnglish ? 'Privacy Policy' : 'מדיניות פרטיות'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.menuItem}
        onPress={() => setScreen('accessibility')}
        android_ripple={{ color: '#ddd' }}
      >
        <Text style={[styles.menuText, { fontSize: screenWidth * 0.045 * textScale }]}>
          ♿ {isEnglish ? 'Accessibility Statement' : 'הצהרת נגישות'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.menuItem}
        onPress={handleLogout}
        android_ripple={{ color: '#faa' }}
      >
        <Text style={[styles.menuText, { color: '#c00', fontSize: screenWidth * 0.045 * textScale }]}>
          🚪 {isEnglish ? 'Logout' : 'התנתקות'}
        </Text>
      </Pressable>
    </View>
  );

  const renderPrivacy = () => (
    <ScrollView contentContainerStyle={styles.contentContainer}>
      <Text style={[styles.title, { fontSize: screenWidth * 0.055 * textScale }]}>
        {isEnglish ? 'Privacy Policy' : 'מדיניות פרטיות'}
      </Text>
      <Text style={[styles.paragraph, { fontSize: screenWidth * 0.04 * textScale }]}>
        {isEnglish
          ? 'The app stores personal data only for logging workouts...'
          : 'האפליקציה שומרת מידע אישי רק למטרות תיעוד ומעקב אחר אימונים.'}
      </Text>
      <Pressable onPress={() => setScreen('menu')} style={styles.backButton}>
        <Text style={[styles.backText, { fontSize: screenWidth * 0.04 * textScale }]}>
          ← {isEnglish ? 'Back to Menu' : 'חזרה לתפריט'}
        </Text>
      </Pressable>
    </ScrollView>
  );

  const renderAccessibility = () => (
    <ScrollView contentContainerStyle={styles.contentContainer}>
      <Text style={[styles.title, { fontSize: screenWidth * 0.055 * textScale }]}>
        {isEnglish ? 'Accessibility Statement' : 'הצהרת נגישות'}
      </Text>
      <Text style={[styles.paragraph, { fontSize: screenWidth * 0.04 * textScale }]}>
        {isEnglish
          ? 'We aim to make the app accessible to all users, including people with disabilities...'
          : 'אנו שואפים להנגיש את האפליקציה לכלל המשתמשים, כולל אנשים עם מוגבלויות.'}
      </Text>
      <Pressable onPress={() => setScreen('menu')} style={styles.backButton}>
        <Text style={[styles.backText, { fontSize: screenWidth * 0.04 * textScale }]}>
          ← {isEnglish ? 'Back to Menu' : 'חזרה לתפריט'}
        </Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <AppLayout>
      {screen === 'menu' && renderMenu()}
      {screen === 'privacy' && renderPrivacy()}
      {screen === 'accessibility' && renderAccessibility()}

      {/* Modal הגדרות */}
      <Modal visible={settingsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isEnglish ? 'Settings' : 'הגדרות'}</Text>

            {/* שינוי שפה */}
            <View style={styles.optionRow}>
              <Text style={styles.optionText}>{isEnglish ? 'English' : 'עברית'}</Text>
              <Switch value={isEnglish} onValueChange={(val) => setIsEnglish(val)} />
            </View>

            {/* הגדלת טקסט */}
            <View style={styles.optionRow}>
              <Text style={styles.optionText}>{isEnglish ? 'Text Size' : 'גודל טקסט'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={() => setTextScale(1)}
                  style={[styles.textSizeButton, textScale === 1 && styles.textSizeButtonActive]}
                >
                  <Text>A</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTextScale(1.2)}
                  style={[styles.textSizeButton, textScale === 1.2 && styles.textSizeButtonActive]}
                >
                  <Text>A+</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTextScale(1.5)}
                  style={[styles.textSizeButton, textScale === 1.5 && styles.textSizeButtonActive]}
                >
                  <Text>A++</Text>
                </Pressable>
              </View>
            </View>

            <Pressable onPress={() => setSettingsVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>{isEnglish ? 'Close' : 'סגור'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
menuContainer: {
  flex: 1,
  alignItems: 'center', // מרכז את כל הכפתורים במסך
  justifyContent: 'flex-start',
  paddingTop: screenHeight * 0.02,
  gap: screenHeight * 0.03,
},

menuItem: {
  width: '80%', // רוחב הכפתור יחסית למסך
  paddingVertical: screenHeight * 0.012,
  paddingLeft: screenWidth * 0.07,
  // paddingHorizontal: screenWidth * 0.066,
  flexShrink: 0,
  alignItems: 'center', // מרכז את התוכן בתוך הכפתור
},

menuText: {
  fontWeight: '600',
  color: '#333',
  textAlign: 'center', // מרכז את הטקסט בתוך הכפתור
},

  menuText: {
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  contentContainer: {
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: screenHeight * 0.04,
    alignItems: 'flex-end',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: screenHeight * 0.025,
    textAlign: 'right',
  },
  paragraph: {
    marginBottom: screenHeight * 0.02,
    textAlign: 'right',
    lineHeight: screenHeight * 0.03,
    color: '#333',
  },
  backButton: {
    marginTop: screenHeight * 0.04,
    paddingVertical: screenHeight * 0.015,
  },
  backText: {
    color: '#007AFF',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: screenWidth * 0.8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  optionText: {
    fontSize: 16,
  },
  textSizeButton: {
    padding: 5,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  textSizeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    color: '#fff',
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  closeText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
