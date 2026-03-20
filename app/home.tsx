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
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../database/firebase';
import AppLayout from './components/AppLayout';

const APP_BG = '#F4F7FB';

const normalizeText = (text: string) =>
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

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
};

type RepsPerSetType = {
  [key: string]: {
    reps: string;
    weight: string;
  };
};

type ExerciseType = {
  name: string;
  numSets: string;
  repsPerSet: RepsPerSetType;
  suggestions: string[];
  showSuggestions: boolean;
  error: string;
};

export default function Home() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 360;

  const dynamic = useMemo(() => {
    const horizontalPadding = width * 0.05;
    const cardWidth = Math.min(width * 0.92, 520);
    const inputHeight = isSmallScreen ? 46 : 50;
    const titleSize = width < 380 ? 22 : 26;
    const labelSize = width < 380 ? 14 : 15;
    const textSize = width < 380 ? 14 : 16;
    const buttonHeight = isSmallScreen ? 52 : 56;

    return {
      horizontalPadding,
      cardWidth,
      inputHeight,
      titleSize,
      labelSize,
      textSize,
      buttonHeight,
    };
  }, [width, isSmallScreen]);

  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [userName, setUserName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [existingExercises, setExistingExercises] = useState<string[]>([]);
  const [addError, setAddError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastExerciseData, setLastExerciseData] = useState<any>({});
  const [selectedExerciseForModal, setSelectedExerciseForModal] = useState<string | null>(null);

  const [exercise, setExercise] = useState<ExerciseType>({
    name: '',
    numSets: '',
    repsPerSet: {},
    suggestions: [],
    showSuggestions: false,
    error: '',
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
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
          new Set(snapshot.docs.map((item) => item.data().exerciseName))
        );

        setExistingExercises(uniqueNames);
      } catch (error) {
        console.error('שגיאה בשליפת נתוני משתמש:', error);
      }
    };

    fetchUserData();
  }, []);

  const fetchLastExercise = async (exerciseName: string) => {
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
          .map((item) => item.data())
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

        setLastExerciseData((prev: any) => ({
          ...prev,
          [exerciseName]: sorted[0],
        }));
      }
    } catch (error) {
      console.error('שגיאה בשליפת האימון האחרון:', error);
    }
  };

  const onChangeDate = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleExerciseChange = (key: keyof ExerciseType, value: any) => {
    if (addError) setAddError('');

    const updated: ExerciseType = {
      ...exercise,
      [key]: value,
    };

    if (key === 'numSets') {
      const cleanedValue = String(value).replace(/[^0-9]/g, '');
      updated.numSets = cleanedValue;

      const num = parseInt(cleanedValue, 10);

      if (num > 10) {
        updated.error = 'לא ניתן להזין יותר מ־10 סטים';
      } else {
        updated.error = '';
        updated.repsPerSet = Array.from({ length: num || 0 }, (_, j) =>
          exercise.repsPerSet[j]
            ? exercise.repsPerSet[j]
            : { reps: '', weight: '' }
        ).reduce((acc: RepsPerSetType, val, j) => {
          acc[j] = val;
          return acc;
        }, {});
      }
    }

    if (key === 'name') {
      const input = normalizeText(String(value));

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

  const handleWeightChange = (setIndex: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');

    setExercise((prev) => ({
      ...prev,
      repsPerSet: {
        ...prev.repsPerSet,
        [setIndex]: {
          ...(prev.repsPerSet[setIndex] || {}),
          weight: cleaned,
        },
      },
    }));
  };

  const handleRepsChange = (setIndex: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');

    setExercise((prev) => ({
      ...prev,
      repsPerSet: {
        ...prev.repsPerSet,
        [setIndex]: {
          ...(prev.repsPerSet[setIndex] || {}),
          reps: cleaned,
        },
      },
    }));
  };

  const handleSelectSuggestion = async (suggestion: string) => {
    setExercise((prev) => ({
      ...prev,
      name: suggestion,
      suggestions: [],
      showSuggestions: false,
    }));

    await fetchLastExercise(suggestion);
  };

  const isExerciseValid = (ex: ExerciseType) => {
    if (!ex.name?.trim() || !ex.numSets || parseInt(ex.numSets, 10) <= 0) {
      return false;
    }

    for (let i = 0; i < parseInt(ex.numSets, 10); i++) {
      const set = ex.repsPerSet[i];
      if (!set || !set.reps || !set.weight) {
        return false;
      }
    }

    return true;
  };

  const handleAddPress = async () => {
    if (isSaving) return;

    if (!isExerciseValid(exercise)) {
      showToast('אנא מלאי את כל השדות לפני שמירה');
      return;
    }

    setIsSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        showToast('לא נמצא משתמש מחובר');
        setIsSaving(false);
        return;
      }

      const trimmedExerciseName = exercise.name.trim();
      const dateKey = date.toLocaleDateString('he-IL');

      await addDoc(collection(db, 'workouts'), {
        uid: user.uid,
        date: date.toISOString(),
        dateKey,
        exerciseName: trimmedExerciseName,
        numSets: parseInt(exercise.numSets, 10),
        repsPerSet: exercise.repsPerSet,
        createdAt: new Date().toISOString(),
      });

      const alreadyExists = existingExercises.some(
        (name) => normalizeText(name) === normalizeText(trimmedExerciseName)
      );

      if (!alreadyExists) {
        await addDoc(collection(db, 'exercises'), {
          uid: user.uid,
          exerciseName: trimmedExerciseName,
          createdAt: new Date().toISOString(),
        });

        setExistingExercises((prev) => [...new Set([...prev, trimmedExerciseName])]);
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
      showToast('אירעה שגיאה בשמירה. נסי שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const greeting = getGreeting();
  const selectedLastExercise =
    selectedExerciseForModal && lastExerciseData[selectedExerciseForModal]
      ? lastExerciseData[selectedExerciseForModal]
      : null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.screen}>
        <AppLayout>
          <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingTop: height * 0.03,
                  paddingBottom: height * 0.05,
                  paddingHorizontal: dynamic.horizontalPadding,
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.card,
                  {
                    width: dynamic.cardWidth,
                    paddingHorizontal: width * 0.05,
                    paddingVertical: height * 0.03,
                  },
                ]}
              >
                <View style={styles.header}>
                  <Text
                    style={[
                      styles.title,
                      {
                        fontSize: dynamic.titleSize,
                        lineHeight: dynamic.titleSize * 1.45,
                      },
                    ]}
                  >
                    היי {userName ? `${userName}, ` : ''}
                    {greeting}
                    {'\n'}
                    הגיע הזמן להזין אימון
                  </Text>
                  <Text style={[styles.subtitle, { fontSize: dynamic.textSize - 1 }]}>
                    שמרי תרגיל חדש בצורה מסודרת, נקייה ונוחה
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>תאריך</Text>

                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}
                  >
                    <MaterialIcons name="date-range" size={20} color="#5B6470" />
                    <Text style={[styles.inputText, { fontSize: dynamic.textSize }]}>
                      {date.toLocaleDateString('he-IL')}
                    </Text>
                  </Pressable>

                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="default"
                      onChange={onChangeDate}
                    />
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>
                    {exercise.name?.trim() ? exercise.name : 'תרגיל'}
                  </Text>

                  <View style={styles.exerciseRow}>
                    <TextInput
                      style={[
                        styles.inputBox,
                        styles.textInput,
                        styles.flexInput,
                        { minHeight: dynamic.inputHeight, fontSize: dynamic.textSize },
                      ]}
                      placeholder="שם תרגיל"
                      placeholderTextColor="#8A94A6"
                      value={exercise.name}
                      onChangeText={(text) => handleExerciseChange('name', text)}
                      textAlign="right"
                    />

                    {exercise.name.trim() !== '' && lastExerciseData[exercise.name] && (
                      <Pressable
                        style={[styles.iconButton, { minHeight: dynamic.inputHeight }]}
                        onPress={() => setSelectedExerciseForModal(exercise.name)}
                      >
                        <MaterialIcons name="fitness-center" size={20} color="#FFFFFF" />
                      </Pressable>
                    )}
                  </View>

                  {exercise.showSuggestions && (
                    <View style={styles.suggestionsContainer}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {exercise.suggestions.map((name, index) => (
                          <Pressable
                            key={`${name}-${index}`}
                            onPress={() => handleSelectSuggestion(name)}
                            style={styles.suggestionItem}
                          >
                            <Text
                              style={[
                                styles.suggestionText,
                                { fontSize: dynamic.textSize - 1 },
                              ]}
                            >
                              {name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>מספר סטים</Text>

                  <TextInput
                    style={[
                      styles.inputBox,
                      styles.textInput,
                      { minHeight: dynamic.inputHeight, fontSize: dynamic.textSize },
                    ]}
                    placeholder="הזיני מספר סטים"
                    placeholderTextColor="#8A94A6"
                    keyboardType="numeric"
                    value={exercise.numSets}
                    onChangeText={(text) => handleExerciseChange('numSets', text)}
                    textAlign="right"
                  />

                  {!!exercise.error && (
                    <Text style={[styles.errorText, { fontSize: dynamic.textSize - 2 }]}>
                      {exercise.error}
                    </Text>
                  )}
                </View>

                {!exercise.error &&
                  Object.keys(exercise.repsPerSet || {}).map((setKey) => (
                    <View key={setKey} style={styles.setCard}>
                      <Text style={[styles.setTitle, { fontSize: dynamic.labelSize }]}>
                        סט {parseInt(setKey, 10) + 1}
                      </Text>

                      <View
                        style={[
                          styles.setInputsRow,
                          { gap: width < 380 ? 8 : 10, flexWrap: 'wrap' },
                        ]}
                      >
                        <View style={styles.setInputWrapper}>
                          <Text style={styles.miniLabel}>חזרות</Text>
                          <TextInput
                            style={[
                              styles.inputBox,
                              styles.textInput,
                              styles.smallInput,
                              { minHeight: dynamic.inputHeight, fontSize: dynamic.textSize },
                            ]}
                            placeholder="לדוגמה 12"
                            placeholderTextColor="#8A94A6"
                            keyboardType="numeric"
                            value={exercise.repsPerSet[setKey]?.reps || ''}
                            onChangeText={(val) => handleRepsChange(setKey, val)}
                            textAlign="right"
                          />
                        </View>

                        <View style={styles.setInputWrapper}>
                          <Text style={styles.miniLabel}>משקל</Text>
                          <TextInput
                            style={[
                              styles.inputBox,
                              styles.textInput,
                              styles.smallInput,
                              { minHeight: dynamic.inputHeight, fontSize: dynamic.textSize },
                            ]}
                            placeholder="לדוגמה 20"
                            placeholderTextColor="#8A94A6"
                            keyboardType="numeric"
                            value={exercise.repsPerSet[setKey]?.weight || ''}
                            onChangeText={(val) => handleWeightChange(setKey, val)}
                            textAlign="right"
                          />
                        </View>
                      </View>
                    </View>
                  ))}

                {!!addError && (
                  <Text style={[styles.errorText, { fontSize: dynamic.textSize - 2 }]}>
                    {addError}
                  </Text>
                )}

                <Pressable
                  style={[
                    styles.saveButton,
                    { minHeight: dynamic.buttonHeight },
                    isSaving && styles.disabledButton,
                  ]}
                  onPress={handleAddPress}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="save" size={20} color="#FFFFFF" />
                      <Text style={[styles.saveButtonText, { fontSize: dynamic.textSize }]}>
                        שמור אימון
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </AppLayout>

        <Modal
          visible={!!selectedExerciseForModal}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedExerciseForModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { width: Math.min(width * 0.88, 420) }]}>
              <Pressable
                style={styles.modalClose}
                onPress={() => setSelectedExerciseForModal(null)}
              >
                <MaterialIcons name="close" size={24} color="#222" />
              </Pressable>

              {selectedLastExercise ? (
                <>
                  <Text style={styles.modalTitle}>
                    הביצוע האחרון של{'\n'}
                    {selectedExerciseForModal}
                  </Text>

                  <View style={styles.modalDivider} />

                  {Object.entries(selectedLastExercise.repsPerSet).map(
                    ([setKey, val]: any) => (
                      <View key={setKey} style={styles.modalRow}>
                        <Text style={styles.modalText}>סט {parseInt(setKey, 10) + 1}</Text>
                        <Text style={styles.modalText}>{val.reps} חזרות</Text>
                        <Text style={styles.modalText}>{val.weight} ק״ג</Text>
                      </View>
                    )
                  )}
                </>
              ) : (
                <Text style={styles.modalText}>אין מידע זמין</Text>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },

  title: {
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },

  subtitle: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },

  section: {
    marginBottom: 18,
  },

  label: {
    color: '#334155',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },

  inputBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D7DFE9',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  textInput: {
    color: '#111827',
  },

  inputText: {
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    marginRight: 10,
  },

  exerciseRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: 10,
  },

  flexInput: {
    flex: 1,
  },

  iconButton: {
    minWidth: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#556070',
    alignItems: 'center',
    justifyContent: 'center',
  },

  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D7DFE9',
    backgroundColor: '#FFFFFF',
    maxHeight: 180,
    overflow: 'hidden',
  },

  suggestionItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  suggestionText: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    textAlign: 'right',
    color: '#1F2937',
  },

  errorText: {
    color: '#DC2626',
    marginTop: 8,
    textAlign: 'right',
    fontWeight: '500',
  },

  setCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },

  setTitle: {
    textAlign: 'right',
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },

  setInputsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },

  setInputWrapper: {
    flex: 1,
    minWidth: 120,
  },

  miniLabel: {
    textAlign: 'right',
    color: '#64748B',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },

  smallInput: {
    width: '100%',
  },

  saveButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },

  modalClose: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },

  modalTitle: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 12,
  },

  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },

  modalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 10,
  },

  modalText: {
    fontSize: 15,
    color: '#334155',
    textAlign: 'right',
    flex: 1,
  },
});