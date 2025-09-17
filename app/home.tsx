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

  const [exerciseList, setExerciseList] = useState([
    {
      name: '',
      numSets: '',
      repsPerSet: {},
      expanded: true,
      suggestions: [],
      showSuggestions: false,
      error: '',
    },
  ]);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserName(userSnap.data().name || '');
      }

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
        setLastExerciseData((prev) => ({
          ...prev,
          [exerciseName]: sorted[0],
        }));
      }
    } catch (error) {
      console.error('שגיאה בשליפת האימון האחרון:', error);
    }
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleExerciseChange = (index, key, value) => {
    if (addError !== '') setAddError('');

    setExerciseList((prev) =>
      prev.map((ex, i) => {
        if (i !== index) return ex;
        const updated = { ...ex, [key]: value };

        if (key === 'numSets') {
          const num = parseInt(value);
          if (num > 10) {
            updated.error = 'לא ניתן להזין יותר מ־10 סטים';
          } else {
            updated.error = '';
            updated.repsPerSet = Array.from({ length: num || 0 }, (_, j) =>
              ex.repsPerSet[j] ? ex.repsPerSet[j] : { reps: '', weight: '' }
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

        return updated;
      })
    );
  };

  const handleWeightChange = (exerciseIndex, setIndex, value) => {
    setExerciseList((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? {
              ...ex,
              repsPerSet: {
                ...ex.repsPerSet,
                [setIndex]: {
                  ...(ex.repsPerSet[setIndex] || {}),
                  weight: value,
                },
              },
            }
          : ex
      )
    );
  };

  const handleRepsChange = (exerciseIndex, setIndex, value) => {
    setExerciseList((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? {
              ...ex,
              repsPerSet: {
                ...ex.repsPerSet,
                [setIndex]: {
                  ...(ex.repsPerSet[setIndex] || {}),
                  reps: value,
                },
              },
            }
          : ex
      )
    );
  };

  const handleSelectSuggestion = async (index, suggestion) => {
    setExerciseList((prev) =>
      prev.map((ex, i) =>
        i === index
          ? { ...ex, name: suggestion, suggestions: [], showSuggestions: false }
          : ex
      )
    );
    await fetchLastExercise(suggestion);
  };

  const handleDeleteExercise = (index) => {
    setExerciseList((prev) => prev.filter((_, i) => i !== index));
  };

  const isExerciseValid = (exercise) => {
    if (!exercise || !exercise.name?.trim() || !exercise.numSets || parseInt(exercise.numSets) <= 0)
      return false;
    for (let i = 0; i < parseInt(exercise.numSets); i++) {
      const set = exercise.repsPerSet[i];
      if (!set || !set.reps || !set.weight) return false;
    }
    return true;
  };

  const handleAddNewExercise = () => {
    if (exerciseList.length === 0) {
      setExerciseList([
        {
          name: '',
          numSets: '',
          repsPerSet: {},
          expanded: true,
          suggestions: [],
          showSuggestions: false,
          error: '',
        },
      ]);
      setAddError('');
      return;
    }
    const lastExercise = exerciseList[exerciseList.length - 1];
    if (!isExerciseValid(lastExercise)) {
      setAddError('אנא מלא את כל שדות התרגיל לפני הוספת תרגיל חדש.');
      return;
    }
    setAddError('');
    setExerciseList((prev) => [
      ...prev.map((ex) => ({ ...ex, expanded: false })),
      {
        name: '',
        numSets: '',
        repsPerSet: {},
        expanded: true,
        suggestions: [],
        showSuggestions: false,
        error: '',
      },
    ]);
  };

  const toggleExercise = (index) => {
    setExerciseList((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, expanded: !ex.expanded } : ex))
    );
  };

  const handleAddPress = async () => {
    if (isSaving) return;

    for (const exercise of exerciseList) {
      if (!isExerciseValid(exercise)) {
        showToast('אנא מלא את כל השדות בכל התרגילים לפני שמירה.');
        return;
      }
    }

    setIsSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setIsSaving(false);
        return;
      }

      for (const exercise of exerciseList) {
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
      }

      setExerciseList([
        {
          name: '',
          numSets: '',
          repsPerSet: {},
          expanded: true,
          suggestions: [],
          showSuggestions: false,
          error: '',
        },
      ]);
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
          <View style={styles.containerAllElement}>
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
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

                {exerciseList.map((exercise, idx) => (
                  <View key={idx} style={{ width: '100%', marginBottom: 20 }}>
                    <Pressable onPress={() => toggleExercise(idx)}>
                      <Text style={styles.label}>
                        {exercise?.name?.trim() !== '' ? exercise.name : `תרגיל ${idx + 1}`}
                      </Text>
                    </Pressable>

                    {exercise.expanded && (
                      <>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                          <TextInput
                            style={[styles.input, { width: '70%' }]}
                            placeholder="שם תרגיל"
                            placeholderTextColor="#888"
                            value={exercise.name}
                            onChangeText={(text) => handleExerciseChange(idx, 'name', text)}
                            textAlign="right"
                          />
                              {exercise.name.trim() !== '' && lastExerciseData[exercise.name] && (
                                <Pressable
                                  style={styles.lastBtn}
                                  onPress={() => setSelectedExerciseForModal(exercise.name)}
                                >
                                  <MaterialIcons
                                    name="fitness-center"
                                    size={24}
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
                                <Pressable
                                  key={sidx}
                                  onPress={() => handleSelectSuggestion(idx, name)}
                                >
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
                          onChangeText={(text) => handleExerciseChange(idx, 'numSets', text)}
                          textAlign="right"
                        />

                        {exercise.error ? (
                          <Text style={styles.errorText}>{exercise.error}</Text>
                        ) : (
                          Object.keys(exercise.repsPerSet || {}).map((setKey) => (
                            <View key={setKey} style={styles.inlineInputRow}>
                              <Text style={styles.labelInline}>
                                סט {parseInt(setKey) + 1}
                              </Text>
                              <TextInput
                                style={styles.inlineInput}
                                placeholder="חזרות"
                                keyboardType="numeric"
                                placeholderTextColor="#888"
                                value={exercise.repsPerSet[setKey]?.reps || ''}
                                onChangeText={(val) => handleRepsChange(idx, setKey, val)}
                                textAlign="right"
                              />
                              <TextInput
                                style={styles.inlineInput}
                                placeholder="משקל"
                                placeholderTextColor="#888"
                                keyboardType="numeric"
                                value={exercise.repsPerSet[setKey]?.weight || ''}
                                onChangeText={(val) => handleWeightChange(idx, setKey, val)}
                                textAlign="right"
                              />
                            </View>
                          ))
                        )}

                        <Pressable
                          onPress={() => handleDeleteExercise(idx)}
                          style={{ marginTop: 10, alignSelf: 'flex-end' }}
                        >
                          <Text style={{ color: 'red', fontWeight: 'bold' }}>🗑️ מחק תרגיל</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                ))}

                <View style={{ alignItems: 'flex-end', marginVertical: 10 }}>
                  <Pressable onPress={handleAddNewExercise}>
                    <Text style={styles.addButtonText}>+ הוסף תרגיל</Text>
                  </Pressable>

                  {addError !== '' && (
                    <Text style={[styles.errorText, { marginTop: 8 }]}>{addError}</Text>
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
          </View>
        </AppLayout>

        <Modal
          visible={!!selectedExerciseForModal}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setSelectedExerciseForModal(null)}
              >
                <Text style={{ fontSize: 18 , marginBottom: 16 }}>❌</Text>
              </Pressable>
              {selectedExerciseForModal && lastExerciseData[selectedExerciseForModal] ? (
                <>
                  <Text style={styles.modalTitle}>
                     הביצוע האחרון של התרגיל {selectedExerciseForModal}
                  </Text>
                  {Object.entries(lastExerciseData[selectedExerciseForModal].repsPerSet).map(
                    ([setKey, val]) => (
                      <Text key={setKey} style={styles.modalText}>
                        סט {parseInt(setKey) + 1}: {val.reps} חזרות , {val.weight}  ק"ג
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
  scrollContainer: {
    paddingBottom: 40,
    paddingHorizontal: 0,
    paddingTop: screenHeight * 0.05,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  containerAllElement: {
    flex: 1,
  },
  centeredContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  formContainer: {
    width: screenWidth * 0.8,
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    marginTop: screenHeight * 0.03,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  label: {
    marginTop: 15,
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    width: '70%',
    marginTop: 5,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    width: '33%',
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  textRight: {
    textAlign: 'right',
    width: '100%',
    alignSelf: 'flex-end',
  },
  addButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
    alignSelf: 'flex-start',
    color: '#000',
  },
  inlineInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 6,
    minWidth: 30,
    textAlign: 'right',
    marginRight: 20,
    alignSelf: 'flex-end',
  },
  labelInline: {
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'right',
    marginRight: '20%',
    alignSelf: 'flex-end',
  },
  saveButton: {
    backgroundColor: '#8A8484',
    borderRadius: 100,
    minWidth: screenWidth * 0.3,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    width: '70%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    maxHeight: 150,
    marginTop: 5,
    alignSelf: 'flex-end',
    zIndex: 10,
  },
  suggestionText: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    textAlign: 'right',
    fontSize: 14,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 5,
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
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'right',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'right',
    marginVertical: 2,
  },
});
