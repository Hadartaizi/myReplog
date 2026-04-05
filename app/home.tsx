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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
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

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

type ExerciseDocType = {
  uid: string;
  workoutId?: string;
  exerciseName: string;
  name?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
};

type WorkoutDocType = {
  uid: string;
  title: string;
  name?: string;
  date: string;
  dateKey: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
  notes?: string;
  exercises: Array<{
    exerciseName: string;
    name: string;
    sets: number;
    reps: number;
    weight: number;
    createdAt: string;
    updatedAt: string;
    date: string;
  }>;
};

function SaveIcon({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 3h11l3 3v15H5z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Rect x="8" y="3" width="8" height="5" stroke={color} strokeWidth={2} fill="none" />
      <Rect x="8" y="13" width="8" height="6" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function DumbbellIcon({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="7" y1="12" x2="17" y2="12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="5" y1="9" x2="5" y2="15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="8" y1="9.5" x2="8" y2="14.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="16" y1="9.5" x2="16" y2="14.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="19" y1="9" x2="19" y2="15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function CalendarIcon({ size = 22, color = '#556070' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="5" width="18" height="16" rx="3" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth={2} />
      <Line x1="8" y1="3" x2="8" y2="7" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CloseIcon({ size = 24, color = '#222222' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export default function Home() {
  const { width, height } = useWindowDimensions();

  const isVerySmall = width < 340;
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  const dynamic = useMemo(() => {
    const horizontalPadding = isTablet ? width * 0.04 : width * 0.05;
    const cardWidth = Math.min(width * 0.94, 560);
    const inputHeight = isVerySmall ? 44 : isSmallScreen ? 48 : 52;
    const titleSize = isVerySmall ? 19 : isSmallScreen ? 21 : isTablet ? 30 : 26;
    const labelSize = isVerySmall ? 13 : 15;
    const textSize = isVerySmall ? 13 : isSmallScreen ? 14 : 16;
    const buttonHeight = isVerySmall ? 50 : 56;
    const cardPaddingHorizontal = isVerySmall ? 14 : isSmallScreen ? 18 : 22;
    const cardPaddingVertical = isVerySmall ? 18 : 24;

    return {
      horizontalPadding,
      cardWidth,
      inputHeight,
      titleSize,
      labelSize,
      textSize,
      buttonHeight,
      cardPaddingHorizontal,
      cardPaddingVertical,
    };
  }, [width, isVerySmall, isSmallScreen, isTablet]);

  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [userName, setUserName] = useState('');
  const [date, setDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [existingExercises, setExistingExercises] = useState<string[]>([]);
  const [addError, setAddError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastExerciseData, setLastExerciseData] = useState<Record<string, ExerciseDocType[]>>({});
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
          const data = userSnap.data();
          setUserName((data?.name || '').trim());
        }

        const q = query(collection(db, 'exercises'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);

        const uniqueNames = Array.from(
          new Set(
            snapshot.docs
              .map((item) => item.data().exerciseName || item.data().name)
              .filter(Boolean)
          )
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
        collection(db, 'exercises'),
        where('uid', '==', user.uid),
        where('exerciseName', '==', exerciseName)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const sorted = snapshot.docs
          .map((item) => item.data() as ExerciseDocType)
          .sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );

        setLastExerciseData((prev) => ({
          ...prev,
          [exerciseName]: sorted,
        }));
      }
    } catch (error) {
      console.error('שגיאה בשליפת האימון האחרון:', error);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web') return;
    setTempDate(date);
    setShowDatePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
  };

  const onChangeDate = (_event: any, selectedDate?: Date) => {
    if (!selectedDate || isNaN(selectedDate.getTime())) return;

    if (Platform.OS === 'ios') {
      setTempDate(selectedDate);
    } else {
      setDate(selectedDate);
      setTempDate(selectedDate);
      setShowDatePicker(false);
    }
  };

  const confirmIosDate = () => {
    setDate(tempDate);
    setShowDatePicker(false);
  };

  const handleWebDateChange = (value: string) => {
    if (!value) {
      const today = new Date();
      setDate(today);
      setTempDate(today);
      return;
    }

    const newDate = new Date(`${value}T12:00:00`);
    if (isNaN(newDate.getTime())) return;

    setDate(newDate);
    setTempDate(newDate);
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
          exercise.repsPerSet[j] ? exercise.repsPerSet[j] : { reps: '', weight: '' }
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

  const buildExerciseRows = () => {
    const rows: Array<{
      exerciseName: string;
      name: string;
      sets: number;
      reps: number;
      weight: number;
      createdAt: string;
      updatedAt: string;
      date: string;
    }> = [];

    const trimmedName = exercise.name.trim();
    const setsCount = parseInt(exercise.numSets, 10);
    const nowIso = new Date().toISOString();
    const workoutDateIso = date.toISOString();

    for (let i = 0; i < setsCount; i++) {
      const currentSet = exercise.repsPerSet[i];

      rows.push({
        exerciseName: trimmedName,
        name: trimmedName,
        sets: i + 1,
        reps: Number(currentSet.reps),
        weight: Number(currentSet.weight),
        createdAt: nowIso,
        updatedAt: nowIso,
        date: workoutDateIso,
      });
    }

    return rows;
  };

  const handleAddPress = async () => {
    console.log("SAVE SCREEN NEW CODE RUNNING");
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
      const dateKey = formatDateForInput(date);
      const nowIso = new Date().toISOString();
      const workoutDateIso = date.toISOString();

      const exerciseRows = buildExerciseRows();

      const workoutPayload: WorkoutDocType = {
        uid: user.uid,
        title: trimmedExerciseName,
        name: trimmedExerciseName,
        date: workoutDateIso,
        dateKey,
        createdAt: nowIso,
        updatedAt: nowIso,
        exercises: exerciseRows,
      };

      const workoutRef = await addDoc(collection(db, 'workouts'), workoutPayload);

      await Promise.all(
        exerciseRows.map((row) =>
          addDoc(collection(db, 'exercises'), {
            uid: user.uid,
            workoutId: workoutRef.id,
            exerciseName: row.exerciseName,
            name: row.name,
            sets: row.sets,
            reps: row.reps,
            weight: row.weight,
            date: row.date,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
        )
      );

      const alreadyExists = existingExercises.some(
        (name) => normalizeText(name) === normalizeText(trimmedExerciseName)
      );

      if (!alreadyExists) {
        setExistingExercises((prev) => [...new Set([...prev, trimmedExerciseName])]);
      }

      setLastExerciseData((prev) => ({
        ...prev,
        [trimmedExerciseName]: exerciseRows.map((row) => ({
          uid: user.uid,
          workoutId: workoutRef.id,
          exerciseName: row.exerciseName,
          name: row.name,
          sets: row.sets,
          reps: row.reps,
          weight: row.weight,
          date: row.date,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
      }));

      setExercise({
        name: '',
        numSets: '',
        repsPerSet: {},
        suggestions: [],
        showSuggestions: false,
        error: '',
      });

      const today = new Date();
      setDate(today);
      setTempDate(today);
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
  const titleLineOne = userName ? `${greeting} ${userName}` : greeting;

  const selectedLastExercise =
    selectedExerciseForModal && lastExerciseData[selectedExerciseForModal]
      ? lastExerciseData[selectedExerciseForModal]
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
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
                  paddingTop: Math.max(height * 0.025, 18),
                  paddingBottom: Math.max(height * 0.05, 32),
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
                    paddingHorizontal: dynamic.cardPaddingHorizontal,
                    paddingVertical: dynamic.cardPaddingVertical,
                  },
                ]}
              >
                <View style={styles.header}>
                  <View style={styles.titleWrapper}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.68}
                      style={[
                        styles.title,
                        styles.titleFirstLine,
                        {
                          fontSize: dynamic.titleSize,
                          lineHeight: dynamic.titleSize * 1.25,
                        },
                      ]}
                    >
                      {titleLineOne}
                    </Text>

                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.74}
                      style={[
                        styles.title,
                        styles.titleSecondLine,
                        {
                          fontSize: dynamic.titleSize,
                          lineHeight: dynamic.titleSize * 1.25,
                        },
                      ]}
                    >
                      הגיע הזמן להזין אימון
                    </Text>
                  </View>

                  <Text style={[styles.subtitle, { fontSize: dynamic.textSize - 1 }]}>
                    שמרי תרגיל חדש בצורה מסודרת, נקייה ונוחה
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>
                    תאריך האימון
                  </Text>

                  {Platform.OS === 'web' ? (
                    <View style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}>
                      <input
                        type="date"
                        value={formatDateForInput(date)}
                        onChange={(e) => handleWebDateChange(e.target.value)}
                        style={{
                          width: '100%',
                          height: 44,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: dynamic.textSize,
                          color: '#111827',
                          direction: 'rtl',
                          textAlign: 'right',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={openDatePicker}
                      style={({ pressed }) => [
                        styles.dateField,
                        { minHeight: dynamic.inputHeight },
                        pressed && styles.dateFieldPressed,
                      ]}
                    >
                      <View style={styles.dateFieldRight}>
                        <Text style={[styles.dateValue, { fontSize: dynamic.textSize }]}>
                          {date.toLocaleDateString('he-IL')}
                        </Text>
                        <Text style={styles.dateHint}>לחצי כדי לשנות תאריך</Text>
                      </View>

                      <CalendarIcon size={22} color="#556070" />
                    </Pressable>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>
                    תרגיל
                  </Text>

                  <View
                    style={[
                      styles.exerciseRow,
                      isVerySmall && styles.exerciseRowStack,
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.inputBox,
                        styles.textInput,
                        styles.flexInput,
                        isVerySmall && styles.fullWidthOnSmall,
                        { minHeight: dynamic.inputHeight, fontSize: dynamic.textSize },
                      ]}
                      placeholder="שם תרגיל"
                      placeholderTextColor="#8A94A6"
                      value={exercise.name}
                      onChangeText={(text) => handleExerciseChange('name', text)}
                      textAlign="right"
                      editable={!isSaving}
                    />

                    {exercise.name.trim() !== '' && lastExerciseData[exercise.name] && (
                      <Pressable
                        style={[
                          styles.iconButton,
                          { minHeight: dynamic.inputHeight },
                          isVerySmall && styles.fullWidthButtonOnSmall,
                        ]}
                        onPress={() => setSelectedExerciseForModal(exercise.name)}
                      >
                        <DumbbellIcon size={26} color="#FFFFFF" />
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
                  <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>
                    מספר סטים
                  </Text>

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
                    editable={!isSaving}
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
                          isSmallScreen && styles.setInputsColumn,
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
                            editable={!isSaving}
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
                            editable={!isSaving}
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
                      <SaveIcon size={20} color="#FFFFFF" />
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

        {showDatePicker && Platform.OS === 'android' && (
          <Modal
            transparent
            animationType="fade"
            visible={showDatePicker}
            onRequestClose={closeDatePicker}
          >
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalCard}>
                <Text style={styles.dateModalTitle}>בחרי תאריך</Text>

                <DateTimePicker
                  value={date}
                  mode="date"
                  display="calendar"
                  onChange={onChangeDate}
                />

                <Pressable style={styles.dateModalButton} onPress={closeDatePicker}>
                  <Text style={styles.dateModalButtonText}>סגור</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}

        {showDatePicker && Platform.OS === 'ios' && (
          <Modal
            transparent
            animationType="slide"
            visible={showDatePicker}
            onRequestClose={closeDatePicker}
          >
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalCard}>
                <Text style={styles.dateModalTitle}>בחרי תאריך</Text>

                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={onChangeDate}
                />

                <View style={styles.iosButtonsRow}>
                  <Pressable
                    style={[styles.dateModalButton, styles.iosHalfButton]}
                    onPress={closeDatePicker}
                  >
                    <Text style={styles.dateModalButtonText}>ביטול</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.dateModalButton, styles.iosHalfButton]}
                    onPress={confirmIosDate}
                  >
                    <Text style={styles.dateModalButtonText}>אישור</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        <Modal
          visible={!!selectedExerciseForModal}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedExerciseForModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { width: Math.min(width * 0.9, 420) }]}>
              <Pressable
                style={styles.modalClose}
                onPress={() => setSelectedExerciseForModal(null)}
              >
                <CloseIcon size={24} color="#222222" />
              </Pressable>

              {selectedLastExercise && selectedLastExercise.length > 0 ? (
                <>
                  <Text style={styles.modalTitle}>
                    הביצוע האחרון של{'\n'}
                    {selectedExerciseForModal}
                  </Text>

                  <View style={styles.modalDivider} />

                  {selectedLastExercise.map((item, index) => (
                    <View key={`${item.sets}-${index}`} style={styles.modalRow}>
                      <Text style={styles.modalText}>סט {item.sets}</Text>
                      <Text style={styles.modalText}>{item.reps} חזרות</Text>
                      <Text style={styles.modalText}>{item.weight} ק״ג</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.modalText}>אין מידע זמין</Text>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  screen: {
    flex: 1,
    backgroundColor: APP_BG,
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

  titleWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  title: {
    width: '100%',
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  titleFirstLine: {
    writingDirection: 'rtl',
    includeFontPadding: false,
  },

  titleSecondLine: {
    writingDirection: 'rtl',
    includeFontPadding: false,
  },

  subtitle: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
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
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
  },

  dateField: {
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

  dateFieldPressed: {
    opacity: 0.9,
  },

  dateFieldRight: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },

  dateValue: {
    color: '#111827',
    fontWeight: '700',
    textAlign: 'right',
  },

  dateHint: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },

  exerciseRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: 10,
  },

  exerciseRowStack: {
    flexDirection: 'column',
  },

  flexInput: {
    flex: 1,
  },

  fullWidthOnSmall: {
    width: '100%',
    flex: undefined,
  },

  fullWidthButtonOnSmall: {
    width: '100%',
    minWidth: '100%',
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
    gap: 10,
  },

  setInputsColumn: {
    flexDirection: 'column',
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
    paddingHorizontal: 16,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  dateModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },

  dateModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },

  dateModalButton: {
    marginTop: 16,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateModalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  iosButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },

  iosHalfButton: {
    flex: 1,
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