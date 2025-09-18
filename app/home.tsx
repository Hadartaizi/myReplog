import DateTimePicker from '@react-native-community/datetimepicker';
import { useFonts } from 'expo-font';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
  ToastAndroid,
  Modal,
} from 'react-native';
import { auth, db } from '../database/firebase';
import AppLayout from './components/AppLayout';
import { MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// פונקציה לרספונסיביות טקסט
const normalizeFont = (size) => Math.round(size * (screenWidth / 375));

const normalizeText = (text) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^֐-׿\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 18) return 'צהריים טובים';
  return 'ערב טוב';
};

const showToast = (message) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
};

export default function Home() {
  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [userName, setUserName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [existingExercises, setExistingExercises] = useState([]);
  const [addError, setAddError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastExerciseData, setLastExerciseData] = useState({});
  const [selectedExerciseForModal, setSelectedExerciseForModal] = useState(null);

  const [exercise, setExercise] = useState({
    name: '',
    numSets: '',
    repsPerSet: {},
    suggestions: [],
    showSuggestions: false,
    error: '',
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) setUserName(userSnap.data().name || '');

      const q = query(collection(db, 'exercises'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      const uniqueNames = Array.from(
        new Set(snapshot.docs.map((doc) => doc.data().exerciseName))
      );
      setExistingExercises(uniqueNames);
    };

    fetchUserData();
  }, []);

  const fetchLastExercise = async (exerciseName) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, 'workouts'),
        where('uid', '==', user.uid),
        where('exerciseName', '==', exerciseName)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const sorted = snapshot.docs
          .map((doc) => doc.data())
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setLastExerciseData({ [exerciseName]: sorted[0] });
      }
    } catch (error) {
      console.error('שגיאה בשליפת האימון האחרון:', error);
    }
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleExerciseChange = (key, value) => {
    if (addError !== '') setAddError('');

    const updated = { ...exercise, [key]: value };

    if (key === 'numSets') {
      const num = parseInt(value);
      if (num > 10) {
        updated.error = 'לא ניתן להזין יותר מ־10 סטים';
      } else {
        updated.error = '';
        updated.repsPerSet = Array.from({ length: num || 0 }, (_, j) =>
          exercise.repsPerSet[j] ? exercise.repsPerSet[j] : { reps: '', weight: '' }
        ).reduce((acc, val, j) => ({ ...acc, [j]: val }), {});
      }
    }

    if (key === 'name') {
      const input = normalizeText(value);
      const filtered = input
        ? existingExercises
            .filter((name) => normalizeText(name).includes(input))
            .sort()
        : [];
      updated.suggestions = filtered;
      updated.showSuggestions = filtered.length > 0;
    }

    setExercise(updated);
  };

  const handleWeightChange = (setIndex, value) => {
    setExercise((prev) => ({
      ...prev,
      repsPerSet: {
        ...prev.repsPerSet,
        [setIndex]: {
          ...(prev.repsPerSet[setIndex] || {}),
          weight: value,
        },
      },
    }));
  };

  const handleRepsChange = (setIndex, value) => {
    setExercise((prev) => ({
      ...prev,
      repsPerSet: {
        ...prev.repsPerSet,
        [setIndex]: {
          ...(prev.repsPerSet[setIndex] || {}),
          reps: value,
        },
      },
    }));
  };

  const handleSelectSuggestion = async (suggestion) => {
    setExercise((prev) => ({
      ...prev,
      name: suggestion,
      suggestions: [],
      showSuggestions: false,
    }));
    await fetchLastExercise(suggestion);
  };

  const isExerciseValid = (ex) => {
    if (!ex || !ex.name?.trim() || !ex.numSets || parseInt(ex.numSets) <= 0) return false;
    for (let i = 0; i < parseInt(ex.numSets); i++) {
      const set = ex.repsPerSet[i];
      if (!set || !set.reps || !set.weight) return false;
    }
    return true;
  };

  const handleAddPress = async () => {
    if (isSaving) return;

    if (!isExerciseValid(exercise)) {
      showToast('אנא מלא את כל השדות לפני שמירה.');
      return;
    }

    setIsSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setIsSaving(false);
        return;
      }

      await addDoc(collection(db, 'workouts'), {
        uid: user.uid,
        date: date.toISOString(),
        exerciseName: exercise.name.trim(),
        numSets: parseInt(exercise.numSets),
        repsPerSet: exercise.repsPerSet,
        createdAt: new Date().toISOString(),
      });

      const alreadyExists = existingExercises.some(
        (name) => normalizeText(name) === normalizeText(exercise.name)
      );
      if (!alreadyExists) {
        await addDoc(collection(db, 'exercises'), {
          uid: user.uid,
          exerciseName: exercise.name.trim(),
          createdAt: new Date().toISOString(),
        });
        setExistingExercises((prev) => [...new Set([...prev, exercise.name.trim()])]);
      }

      setExercise({
        name: '',
        numSets: '',
        repsPerSet: {},
        suggestions: [],
        showSuggestions: false,
        error: '',
      });
      setDate(new Date());
      setAddError('');

      showToast('האימון נשמר בהצלחה!');
    } catch (error) {
      console.error('שגיאה בשמירת האימון:', error);
      showToast('אירעה שגיאה בשמירה. נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!fontsLoaded) return null;
  const greeting = getGreeting();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        <AppLayout>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: screenHeight * 0.04,
              paddingTop: screenHeight * 0.05,
              alignItems: 'center',
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.centeredContainer}>
              <Text style={styles.title}>
                היי {userName ? `${userName}, ` : ''}
                {greeting}
                {'\n'}
                הגיע הזמן להזין אימון!
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.label}>תאריך</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateInput}>
                <Text style={styles.textRight}>{date.toLocaleDateString()}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={onChangeDate}
                />
              )}

              <View style={{ width: '100%', marginBottom: screenHeight * 0.02 }}>
                <Text style={styles.label}>
                  {exercise?.name?.trim() !== '' ? exercise.name : `תרגיל`}
                </Text>

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { width: '70%' }]}
                    placeholder="שם תרגיל"
                    placeholderTextColor="#888"
                    value={exercise.name}
                    onChangeText={(text) => handleExerciseChange('name', text)}
                    textAlign="right"
                  />
                  {exercise.name.trim() !== '' &&
                    lastExerciseData[exercise.name] && (
                      <Pressable
                        style={styles.lastBtn}
                        onPress={() => setSelectedExerciseForModal(exercise.name)}
                      >
                        <MaterialIcons
                          name="fitness-center"
                          size={normalizeFont(20)}
                          color="#fff"
                          style={{ marginRight: 20 }}
                        />
                      </Pressable>
                    )}
                </View>

                {exercise.showSuggestions && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView nestedScrollEnabled={true} horizontal={false}>
                      {exercise.suggestions.map((name, sidx) => (
                        <Pressable key={sidx} onPress={() => handleSelectSuggestion(name)}>
                          <Text style={styles.suggestionText}>{name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.label}>מספר סטים</Text>
                <TextInput
                  style={styles.input}
                  placeholder="מספר"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={exercise.numSets}
                  onChangeText={(text) => handleExerciseChange('numSets', text)}
                  textAlign="right"
                />

                {exercise.error ? (
                  <Text style={styles.errorText}>{exercise.error}</Text>
                ) : (
                  Object.keys(exercise.repsPerSet || {}).map((setKey) => (
                    <View key={setKey} style={styles.inlineInputRow}>
                      <Text style={styles.labelInline}>סט {parseInt(setKey) + 1}</Text>
                      <TextInput
                        style={styles.inlineInput}
                        placeholder="חזרות"
                        keyboardType="numeric"
                        placeholderTextColor="#888"
                        value={exercise.repsPerSet[setKey]?.reps || ''}
                        onChangeText={(val) => handleRepsChange(setKey, val)}
                        textAlign="right"
                      />
                      <TextInput
                        style={styles.inlineInput}
                        placeholder="משקל"
                        placeholderTextColor="#888"
                        keyboardType="numeric"
                        value={exercise.repsPerSet[setKey]?.weight || ''}
                        onChangeText={(val) => handleWeightChange(setKey, val)}
                        textAlign="right"
                      />
                    </View>
                  ))
                )}

                {addError !== '' && (
                  <Text style={[styles.errorText, { marginTop: screenHeight * 0.008 }]}>
                    {addError}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.centeredContainer}>
              <Pressable
                style={[styles.saveButton, isSaving && { opacity: 0.5 }]}
                onPress={handleAddPress}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveButtonText}>שמור אימון</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </AppLayout>

        <Modal visible={!!selectedExerciseForModal} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Pressable style={styles.closeBtn} onPress={() => setSelectedExerciseForModal(null)}>
                <Text style={{ fontSize: normalizeFont(18), marginBottom: 16 }}>❌</Text>
              </Pressable>
              {selectedExerciseForModal && lastExerciseData[selectedExerciseForModal] ? (
                <>
                  <Text style={styles.modalTitle}>
                    הביצוע האחרון של התרגיל {selectedExerciseForModal}
                  </Text>
                  {Object.entries(lastExerciseData[selectedExerciseForModal].repsPerSet).map(
                    ([setKey, val]) => (
                      <Text key={setKey} style={styles.modalText}>
                        סט {parseInt(setKey) + 1}: {val.reps} חזרות , {val.weight} ק"ג
                      </Text>
                    )
                  )}
                </>
              ) : (
                <Text>אין מידע זמין</Text>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: screenHeight * 0.02,
  },
  formContainer: {
    width: '90%',
    alignItems: 'flex-end',
    marginTop: screenHeight * 0.03,
  },
  title: {
    fontSize: normalizeFont(20),
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  label: {
    marginTop: screenHeight * 0.015,
    fontWeight: 'bold',
    fontSize: normalizeFont(16),
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.03,
    borderRadius: 6,
    width: '70%',
    marginTop: screenHeight * 0.005,
    textAlign: 'right',
    alignSelf: 'flex-end',
    fontSize: normalizeFont(14),
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.03,
    borderRadius: 6,
    width: screenWidth * 0.4,
    marginTop: screenHeight * 0.005,
    alignSelf: 'flex-end',
    fontSize: normalizeFont(14),
  },
  textRight: {
    textAlign: 'right',
    width: '100%',
    alignSelf: 'flex-end',
  },
  inlineInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: screenHeight * 0.01,
    gap: 10,
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: screenHeight * 0.01,
    paddingHorizontal: screenWidth * 0.02,
    borderRadius: 6,
    minWidth: 40,
    textAlign: 'right',
    fontSize: normalizeFont(14),
  },
  labelInline: {
    fontWeight: 'bold',
    fontSize: normalizeFont(14),
    textAlign: 'right',
    marginRight: '20%',
    alignSelf: 'flex-end',
  },
  saveButton: {
    backgroundColor: '#8A8484',
    borderRadius: 100,
    minWidth: screenWidth * 0.35,
    height: screenHeight * 0.06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: normalizeFont(16),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    width: '70%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    maxHeight: screenHeight * 0.2,
    marginTop: screenHeight * 0.005,
    alignSelf: 'flex-end',
    zIndex: 10,
  },
  suggestionText: {
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    textAlign: 'right',
    fontSize: normalizeFont(14),
  },
  errorText: {
    color: 'red',
    fontSize: normalizeFont(14),
    marginTop: screenHeight * 0.005,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
  },
  closeBtn: {
    alignSelf: 'flex-end',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: normalizeFont(18),
    marginBottom: 10,
    textAlign: 'right',
  },
  modalText: {
    fontSize: normalizeFont(16),
    textAlign: 'right',
    marginVertical: 2,
  },
  lastBtn: {
    backgroundColor: '#8A8484',
    padding: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
});
