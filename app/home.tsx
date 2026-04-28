import DateTimePicker from '@react-native-community/datetimepicker';
import { useFonts } from 'expo-font';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
const DECIMAL_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad';
const INTEGER_KEYBOARD = Platform.OS === 'ios' ? 'number-pad' : 'numeric';

const normalizeText = (text: string) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^֐-׿\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasOwn = (obj: any, key: string) =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);

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

const parseDateSafe = (value: any): Date | null => {
  if (!value) return null;

  if (value?.toDate && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
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

type WorkoutDocType = {
  uid: string;
  title?: string;
  name?: string;
  exerciseName: string;
  date: string;
  dateKey: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  exerciseOrder: number;
  clientEntryOrder: number;
  enteredByClient: boolean;
  numSets: number;
  repsPerSet: RepsPerSetType;
};

type ExerciseDocType = {
  uid: string;
  workoutId?: string;
  exerciseName: string;
  name?: string;
  title?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  order?: number;
  exerciseOrder?: number;
  setOrder?: number;
  clientEntryOrder?: number;
  enteredByClient?: boolean;
};

type LastExerciseRow = {
  sets: number;
  reps: string;
  weight: string;
};

type TrainingProgramExercise = {
  id?: string;
  name?: string;
  sets?: string;
  reps?: string;
  notes?: string;
};

type TrainingProgramSection = {
  id?: string;
  title?: string;
  exercises?: TrainingProgramExercise[];
};

type TrainingProgramDoc = {
  clientUid?: string;
  clientName?: string;
  clientEmail?: string;
  sections?: TrainingProgramSection[];
  notes?: string;
  exerciseHistory?: string[];
  updatedAt?: string;
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

function MenuIcon({ size = 26, color = '#0F172A' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1="4" y1="17" x2="20" y2="17" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function TimerIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="8" y="2.8" width="8" height="3.2" rx="1.2" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M12 21a7 7 0 1 0 0-14a7 7 0 0 0 0 14z" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="12" y1="11" x2="12" y2="15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="12" y1="15" x2="15" y2="15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
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
  const [deletedExerciseNames, setDeletedExerciseNames] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLastExercise, setIsLoadingLastExercise] = useState(false);
  const [lastExerciseData, setLastExerciseData] = useState<Record<string, LastExerciseRow[]>>({});
  const [selectedExerciseForModal, setSelectedExerciseForModal] = useState<string | null>(null);
  const [isExerciseNameFocused, setIsExerciseNameFocused] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState('1');
  const [timerSeconds, setTimerSeconds] = useState('30');
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const [trainingProgram, setTrainingProgram] = useState<TrainingProgramDoc | null>(null);
  const [isLoadingTrainingProgram, setIsLoadingTrainingProgram] = useState(true);
  const [showTrainingProgramModal, setShowTrainingProgramModal] = useState(false);
  const [exercise, setExercise] = useState<ExerciseType>({
    name: '',
    numSets: '',
    repsPerSet: {},
    suggestions: [],
    showSuggestions: false,
    error: '',
  });

  const getExerciseNameFromDoc = (item: any) => {
    if (!item) return '';

    if (hasOwn(item, 'exerciseName')) return String(item.exerciseName ?? '').trim();
    if (hasOwn(item, 'title')) return String(item.title ?? '').trim();
    if (hasOwn(item, 'name')) return String(item.name ?? '').trim();

    return '';
  };

  const hasTrainingProgramContent = useMemo(() => {
    if (!trainingProgram) return false;

    const sections = Array.isArray(trainingProgram.sections) ? trainingProgram.sections : [];
    const hasSections = sections.some((section) => {
      const title = String(section?.title || '').trim();
      const exercises = Array.isArray(section?.exercises) ? section.exercises : [];

      const hasExercises = exercises.some((item) => {
        return (
          String(item?.name || '').trim() ||
          String(item?.sets || '').trim() ||
          String(item?.reps || '').trim() ||
          String(item?.notes || '').trim()
        );
      });

      return !!title || hasExercises;
    });

    const hasNotes = String(trainingProgram.notes || '').trim().length > 0;

    return hasSections || hasNotes;
  }, [trainingProgram]);

  const trainingProgramExerciseNames = useMemo(() => {
    const sections = Array.isArray(trainingProgram?.sections) ? trainingProgram.sections : [];
    const history = Array.isArray(trainingProgram?.exerciseHistory)
      ? trainingProgram.exerciseHistory
      : [];

    const names: string[] = [];
    const seen = new Set<string>();

    const addName = (value?: string | null) => {
      const rawName = String(value || "").trim();
      const normalized = normalizeText(rawName);

      if (!rawName || !normalized || seen.has(normalized)) return;

      seen.add(normalized);
      names.push(rawName);
    };

    history.forEach(addName);

    sections.forEach((section) => {
      const exercises = Array.isArray(section?.exercises) ? section.exercises : [];
      exercises.forEach((item) => addName(item?.name));
    });

    return names.sort((a, b) => a.localeCompare(b, "he"));
  }, [trainingProgram]);


  const loadDeletedExercises = useCallback(async (uid: string) => {
    try {
      const deletedCollectionRef = collection(db, 'users', uid, 'deletedExercises');
      const deletedSnapshot = await getDocs(deletedCollectionRef);

      const deletedSet = new Set(
        deletedSnapshot.docs
          .map((docSnap) => normalizeText(docSnap.data()?.exerciseName || docSnap.id))
          .filter(Boolean)
      );

      setDeletedExerciseNames(deletedSet);
      return deletedSet;
    } catch (error) {
      console.error('שגיאה בשליפת תרגילים שנמחקו:', error);
      const emptySet = new Set<string>();
      setDeletedExerciseNames(emptySet);
      return emptySet;
    }
  }, []);

  const fetchTrainingProgram = useCallback(async (uid: string) => {
    try {
      setIsLoadingTrainingProgram(true);
      const programRef = doc(db, 'clientTrainingPrograms', uid);
      const programSnap = await getDoc(programRef);

      if (!programSnap.exists()) {
        setTrainingProgram(null);
        return;
      }

      const data = programSnap.data() as TrainingProgramDoc;
      setTrainingProgram(data || null);
    } catch (error) {
      console.error('שגיאה בטעינת תוכנית אימון:', error);
      setTrainingProgram(null);
    } finally {
      setIsLoadingTrainingProgram(false);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const workoutsQuery = query(collection(db, 'workouts'), where('uid', '==', user.uid));
      const exercisesQuery = query(collection(db, 'exercises'), where('uid', '==', user.uid));

      const [userSnap, deletedSet, workoutsSnapshot, exercisesSnapshot] = await Promise.all([
        getDoc(userRef),
        loadDeletedExercises(user.uid),
        getDocs(workoutsQuery),
        getDocs(exercisesQuery),
      ]);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserName((data?.name || '').trim());
      }

      const mergedNames = [
        ...trainingProgramExerciseNames,
        ...workoutsSnapshot.docs.map((item) => getExerciseNameFromDoc(item.data())),
        ...exercisesSnapshot.docs.map((item) => getExerciseNameFromDoc(item.data())),
      ].filter(Boolean);

      const uniqueNames: string[] = [];
      const seen = new Set<string>();

      for (const rawName of mergedNames) {
        const normalized = normalizeText(rawName);
        if (!normalized || deletedSet.has(normalized) || seen.has(normalized)) continue;
        seen.add(normalized);
        uniqueNames.push(rawName.trim());
      }

      setExistingExercises(uniqueNames.sort((a, b) => a.localeCompare(b, 'he')));
    } catch (error) {
      console.error('שגיאה בשליפת נתוני משתמש:', error);
    }
  }, [loadDeletedExercises, trainingProgramExerciseNames]);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setTrainingProgram(null);
      setIsLoadingTrainingProgram(false);
      return;
    }

    fetchTrainingProgram(user.uid);
  }, [fetchTrainingProgram]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const buildRepsPerSetForWorkout = () => {
    const result: RepsPerSetType = {};
    const setsCount = parseInt(exercise.numSets, 10);

    for (let i = 0; i < setsCount; i++) {
      result[String(i)] = {
        reps: exercise.repsPerSet[i]?.reps || '',
        weight: exercise.repsPerSet[i]?.weight || '',
      };
    }

    return result;
  };

  const buildExerciseRows = (clientEntryOrder: number, nowIso: string) => {
    const rows: ExerciseDocType[] = [];
    const trimmedName = exercise.name.trim();
    const setsCount = parseInt(exercise.numSets, 10);
    const workoutDateIso = date.toISOString();

    for (let i = 0; i < setsCount; i++) {
      const currentSet = exercise.repsPerSet[i];
      const setOrder = i + 1;

      rows.push({
        uid: '',
        exerciseName: trimmedName,
        name: trimmedName,
        title: trimmedName,
        sets: setOrder,
        reps: Number(currentSet?.reps || 0),
        weight: Number(currentSet?.weight || 0),
        date: workoutDateIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        order: setOrder,
        exerciseOrder: clientEntryOrder,
        setOrder,
        clientEntryOrder,
        enteredByClient: true,
      });
    }

    return rows;
  };

  const removeOldDeletedCopiesIfExist = async (uid: string, exerciseName: string) => {
    const normalizedTarget = normalizeText(exerciseName);
    const deletedDocRef = doc(db, 'users', uid, 'deletedExercises', normalizedTarget);
    const deletedDocSnap = await getDoc(deletedDocRef);

    if (!deletedDocSnap.exists()) return;

    const workoutsQuery = query(collection(db, 'workouts'), where('uid', '==', uid));
    const workoutsSnapshot = await getDocs(workoutsQuery);

    await Promise.all(
      workoutsSnapshot.docs
        .filter((docSnap) => normalizeText(getExerciseNameFromDoc(docSnap.data())) === normalizedTarget)
        .map((docSnap) => deleteDoc(doc(db, 'workouts', docSnap.id)))
    );

    const exercisesQuery = query(collection(db, 'exercises'), where('uid', '==', uid));
    const exercisesSnapshot = await getDocs(exercisesQuery);

    await Promise.all(
      exercisesSnapshot.docs
        .filter((docSnap) => normalizeText(getExerciseNameFromDoc(docSnap.data())) === normalizedTarget)
        .map((docSnap) => deleteDoc(doc(db, 'exercises', docSnap.id)))
    );

    await deleteDoc(deletedDocRef);

    setDeletedExerciseNames((prev) => {
      const next = new Set(prev);
      next.delete(normalizedTarget);
      return next;
    });
  };

  const fetchLastExercise = async (exerciseName: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      const normalizedTarget = normalizeText(exerciseName);

      if (deletedExerciseNames.has(normalizedTarget)) {
        setLastExerciseData((prev) => ({
          ...prev,
          [exerciseName]: [],
        }));
        return [];
      }

      setIsLoadingLastExercise(true);

      const q = query(collection(db, 'workouts'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);

      const matchingWorkouts = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return { id: docSnap.id, ...data };
        })
        .filter((item: any) => normalizeText(getExerciseNameFromDoc(item)) === normalizedTarget)
        .sort((a: any, b: any) => {
          const aTime =
            parseDateSafe(a.updatedAt)?.getTime() ||
            parseDateSafe(a.createdAt)?.getTime() ||
            parseDateSafe(a.date)?.getTime() ||
            0;

          const bTime =
            parseDateSafe(b.updatedAt)?.getTime() ||
            parseDateSafe(b.createdAt)?.getTime() ||
            parseDateSafe(b.date)?.getTime() ||
            0;

          return bTime - aTime;
        });

      if (matchingWorkouts.length === 0) {
        setLastExerciseData((prev) => ({
          ...prev,
          [exerciseName]: [],
        }));
        return [];
      }

      const latestWorkout: any = matchingWorkouts[0];
      let rows: LastExerciseRow[] = [];

      if (latestWorkout?.repsPerSet && typeof latestWorkout.repsPerSet === 'object') {
        rows = Object.keys(latestWorkout.repsPerSet)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => ({
            sets: Number(key) + 1,
            reps: String(latestWorkout.repsPerSet[key]?.reps ?? ''),
            weight: String(latestWorkout.repsPerSet[key]?.weight ?? ''),
          }));
      }

      setLastExerciseData((prev) => ({
        ...prev,
        [exerciseName]: rows,
      }));

      return rows;
    } catch (error) {
      console.error('שגיאה בשליפת האימון האחרון:', error);
      return [];
    } finally {
      setIsLoadingLastExercise(false);
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
            .filter((name) => {
              const normalizedName = normalizeText(name);
              return !deletedExerciseNames.has(normalizedName) && normalizedName.includes(input);
            })
            .sort((a, b) => a.localeCompare(b, 'he'))
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

  const clearExerciseName = () => {
    setExercise((prev) => ({
      ...prev,
      name: '',
      suggestions: [],
      showSuggestions: false,
    }));

    if (addError) {
      setAddError('');
    }
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
      const normalizedName = normalizeText(trimmedExerciseName);
      const dateKey = formatDateForInput(date);
      const now = new Date();
      const nowIso = now.toISOString();
      const clientEntryOrder = now.getTime();
      const workoutDateIso = date.toISOString();

      await removeOldDeletedCopiesIfExist(user.uid, trimmedExerciseName);

      const repsPerSetForWorkout = buildRepsPerSetForWorkout();
      const exerciseRows = buildExerciseRows(clientEntryOrder, nowIso);

      const workoutPayload: WorkoutDocType = {
        uid: user.uid,
        title: trimmedExerciseName,
        name: trimmedExerciseName,
        exerciseName: trimmedExerciseName,
        date: workoutDateIso,
        dateKey,
        createdAt: nowIso,
        updatedAt: nowIso,
        order: clientEntryOrder,
        exerciseOrder: clientEntryOrder,
        clientEntryOrder,
        enteredByClient: true,
        numSets: parseInt(exercise.numSets, 10),
        repsPerSet: repsPerSetForWorkout,
      };

      const workoutRef = await addDoc(collection(db, 'workouts'), workoutPayload);

      await Promise.all(
        exerciseRows.map((row) =>
          addDoc(collection(db, 'exercises'), {
            uid: user.uid,
            workoutId: workoutRef.id,
            exerciseName: row.exerciseName,
            name: row.name,
            title: row.title,
            sets: row.sets,
            reps: row.reps,
            weight: row.weight,
            date: row.date,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            order: row.order,
            exerciseOrder: row.exerciseOrder,
            setOrder: row.setOrder,
            clientEntryOrder: row.clientEntryOrder,
            enteredByClient: true,
          })
        )
      );

      setExistingExercises((prev) => {
        const withoutOldDuplicates = prev.filter(
          (name) => normalizeText(name) !== normalizedName
        );
        return [...withoutOldDuplicates, trimmedExerciseName].sort((a, b) =>
          a.localeCompare(b, 'he')
        );
      });

      setLastExerciseData((prev) => ({
        ...prev,
        [trimmedExerciseName]: Object.keys(repsPerSetForWorkout)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => ({
            sets: Number(key) + 1,
            reps: repsPerSetForWorkout[key].reps,
            weight: repsPerSetForWorkout[key].weight,
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
      await fetchUserData();
      showToast('האימון נשמר בהצלחה!');
    } catch (error) {
      console.error('שגיאה בשמירת האימון:', error);
      showToast('אירעה שגיאה בשמירה. נסי שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isTimerRunning || timerRemaining <= 0) return;

    const intervalId = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          showToast('זמן המנוחה הסתיים');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isTimerRunning, timerRemaining]);

  const formatTimer = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const openTimerFromMenu = () => {
    setShowSideMenu(false);
    setShowTimerModal(true);
  };

  const startRestTimer = () => {
    const minutes = parseInt(timerMinutes || '0', 10) || 0;
    const seconds = parseInt(timerSeconds || '0', 10) || 0;
    const totalSeconds = minutes * 60 + seconds;

    if (totalSeconds <= 0) {
      showToast('בחרי זמן מנוחה גדול מ־0');
      return;
    }

    setTimerRemaining(totalSeconds);
    setIsTimerRunning(true);
    setShowTimerModal(false);
  };

  const pauseOrResumeTimer = () => {
    if (timerRemaining <= 0) return;
    setIsTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerRemaining(0);
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

  const trainingSections = Array.isArray(trainingProgram?.sections) ? trainingProgram?.sections : [];

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
                <Pressable
                  style={styles.menuButton}
                  onPress={() => setShowSideMenu(true)}
                  hitSlop={10}
                >
                  <MenuIcon size={26} color="#0F172A" />
                </Pressable>

                {timerRemaining > 0 && (
                  <Pressable style={styles.activeTimerChip} onPress={() => setShowTimerModal(true)}>
                    <Text style={styles.activeTimerText}>מנוחה: {formatTimer(timerRemaining)}</Text>
                  </Pressable>
                )}

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
                </View>

                {isLoadingTrainingProgram ? (
                  <View style={styles.trainingProgramLoader}>
                    <ActivityIndicator color="#0F172A" />
                  </View>
                ) : hasTrainingProgramContent ? (
                  <Pressable
                    style={[
                      styles.trainingProgramButton,
                      { minHeight: dynamic.buttonHeight - 4 },
                    ]}
                    onPress={() => setShowTrainingProgramModal(true)}
                  >
                    <Text style={[styles.trainingProgramButtonText, { fontSize: dynamic.textSize }]}>
                      צפייה בתוכנית אימון
                    </Text>
                  </Pressable>
                ) : null}

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
                    <View
                      style={[
                        styles.inputBox,
                        styles.exerciseNameInputWrap,
                        styles.flexInput,
                        isVerySmall && styles.fullWidthOnSmall,
                        { minHeight: dynamic.inputHeight },
                        isExerciseNameFocused && styles.exerciseNameInputWrapFocused,
                      ]}
                    >
                      {!!exercise.name.trim() && (
                        <Pressable
                          onPress={clearExerciseName}
                          hitSlop={10}
                          style={({ pressed }) => [
                            styles.clearInsideButton,
                            {
                              width: Math.max(28, dynamic.inputHeight * 0.58),
                              height: Math.max(28, dynamic.inputHeight * 0.58),
                              borderRadius: Math.max(14, dynamic.inputHeight * 0.29),
                              left: Math.max(6, dynamic.inputHeight * 0.14),
                            },
                            pressed && styles.pressedButton,
                          ]}
                        >
                          <Text style={styles.clearInsideButtonText}>✕</Text>
                        </Pressable>
                      )}

                      <TextInput
                        style={[
                          styles.exerciseNameTextInput,
                          {
                            fontSize: dynamic.textSize,
                            paddingLeft: exercise.name.trim()
                              ? Math.max(44, dynamic.inputHeight * 0.95)
                              : 10,
                          },
                        ]}
                        placeholder="שם תרגיל"
                        placeholderTextColor="#8A94A6"
                        value={exercise.name}
                        onChangeText={(text) => handleExerciseChange('name', text)}
                        textAlign="right"
                        editable={!isSaving}
                        onFocus={() => setIsExerciseNameFocused(true)}
                        onBlur={() => setIsExerciseNameFocused(false)}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    {exercise.name.trim() !== '' && (
                      <Pressable
                        style={[
                          styles.iconButton,
                          { minHeight: dynamic.inputHeight },
                          isVerySmall && styles.fullWidthButtonOnSmall,
                        ]}
                        onPress={async () => {
                          const trimmedName = exercise.name.trim();
                          await fetchLastExercise(trimmedName);
                          setSelectedExerciseForModal(trimmedName);
                        }}
                        disabled={isLoadingLastExercise}
                      >
                        {isLoadingLastExercise ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <DumbbellIcon size={26} color="#FFFFFF" />
                        )}
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
                    keyboardType={INTEGER_KEYBOARD}
                    inputMode="numeric"
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
                            keyboardType={DECIMAL_KEYBOARD}
                            inputMode="decimal"
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
                            keyboardType={DECIMAL_KEYBOARD}
                            inputMode="decimal"
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
                        שמור תרגיל
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
                <>
                  <Text style={styles.modalTitle}>
                    הביצוע האחרון של{'\n'}
                    {selectedExerciseForModal}
                  </Text>
                  <View style={styles.modalDivider} />
                  <Text style={styles.modalText}>אין מידע זמין</Text>
                </>
              )}
            </View>
          </View>
        </Modal>



        <Modal
          visible={showSideMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSideMenu(false)}
        >
          <Pressable style={styles.sideMenuOverlay} onPress={() => setShowSideMenu(false)}>
            <Pressable style={[styles.sideMenuCard, { width: Math.min(width * 0.78, 300) }]}>
              <View style={styles.sideMenuHeader}>
                <Pressable onPress={() => setShowSideMenu(false)} style={styles.sideMenuClose}>
                  <CloseIcon size={22} color="#0F172A" />
                </Pressable>
                <Text style={styles.sideMenuTitle}>תפריט</Text>
              </View>

              <Pressable style={styles.timerMenuButton} onPress={openTimerFromMenu}>
                <TimerIcon size={22} color="#FFFFFF" />
                <Text style={styles.timerMenuButtonText}>טיימר מנוחה</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={showTimerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.timerModalCard, { width: Math.min(width * 0.9, 420) }]}>
              <View style={styles.timerModalHeader}>
                <Pressable style={styles.modalClose} onPress={() => setShowTimerModal(false)}>
                  <CloseIcon size={24} color="#222222" />
                </Pressable>
                <Text style={styles.timerModalTitle}>טיימר מנוחה</Text>
              </View>

              <Text style={styles.timerDisplay}>{formatTimer(timerRemaining)}</Text>
              <Text style={styles.timerHint}>הגדיר זמן מנוחה ידני בין תרגיל לתרגיל</Text>

              <View style={styles.timerInputsRow}>
                <View style={styles.timerInputBlock}>
                  <Text style={styles.miniLabel}>דקות</Text>
                  <TextInput
                    style={[styles.inputBox, styles.textInput, styles.timerInput]}
                    keyboardType={INTEGER_KEYBOARD}
                    inputMode="numeric"
                    value={timerMinutes}
                    onChangeText={(text) => setTimerMinutes(text.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    placeholderTextColor="#8A94A6"
                    textAlign="center"
                  />
                </View>

                <View style={styles.timerInputBlock}>
                  <Text style={styles.miniLabel}>שניות</Text>
                  <TextInput
                    style={[styles.inputBox, styles.textInput, styles.timerInput]}
                    keyboardType={INTEGER_KEYBOARD}
                    inputMode="numeric"
                    value={timerSeconds}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9]/g, '');
                      const limited = cleaned ? String(Math.min(59, parseInt(cleaned, 10))) : '';
                      setTimerSeconds(limited);
                    }}
                    placeholder="0"
                    placeholderTextColor="#8A94A6"
                    textAlign="center"
                  />
                </View>
              </View>

              <Pressable style={styles.startTimerButton} onPress={startRestTimer}>
                <Text style={styles.startTimerButtonText}>הפעל טיימר</Text>
              </Pressable>

              {timerRemaining > 0 && (
                <View style={styles.timerActionsRow}>
                  <Pressable style={styles.secondaryTimerButton} onPress={pauseOrResumeTimer}>
                    <Text style={styles.secondaryTimerButtonText}>{isTimerRunning ? 'השהה' : 'המשך'}</Text>
                  </Pressable>

                  <Pressable style={styles.secondaryTimerButton} onPress={resetTimer}>
                    <Text style={styles.secondaryTimerButtonText}>איפוס</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={showTrainingProgramModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTrainingProgramModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.programModalCard, { width: Math.min(width * 0.92, 500) }]}>
              <View style={styles.programHeaderRow}>
                <Pressable
                  style={styles.modalClose}
                  onPress={() => setShowTrainingProgramModal(false)}
                >
                  <CloseIcon size={24} color="#222222" />
                </Pressable>

                <Text style={styles.programModalTitle}>תוכנית האימון שלך</Text>
              </View>

              <View style={styles.modalDivider} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.programScrollContent}
              >
                {trainingSections.length > 0 ? (
                  trainingSections.map((section, sectionIndex) => {
                    const sectionTitle = String(section?.title || '').trim();
                    const exercises = Array.isArray(section?.exercises) ? section.exercises : [];

                    if (!sectionTitle && exercises.length === 0) return null;

                    return (
                      <View
                        key={section?.id || `section-${sectionIndex}`}
                        style={styles.programSectionCard}
                      >
                        {!!sectionTitle && (
                          <Text style={styles.programSectionTitle}>{sectionTitle}</Text>
                        )}

                        {exercises.map((item, exerciseIndex) => {
                          const exerciseName = String(item?.name || '').trim();
                          const sets = String(item?.sets || '').trim();
                          const reps = String(item?.reps || '').trim();
                          const notes = String(item?.notes || '').trim();

                          if (!exerciseName && !sets && !reps && !notes) return null;

                          const exerciseKey = item?.id || `exercise-${sectionIndex}-${exerciseIndex}`;

                          return (
                            <View
                              key={exerciseKey}
                              style={styles.programExerciseCard}
                            >
                              <View style={styles.programExerciseHeader}>
                                <Text style={styles.programExerciseName}>
                                  {exerciseName || 'ללא שם תרגיל'}
                                </Text>
                              </View>

                              {(sets || reps) && (
                                <View style={styles.programMetaRow}>
                                  {!!sets && (
                                    <View style={styles.programMetaChip}>
                                      <Text selectable={false} style={styles.programMetaChipText}>סטים: {sets}</Text>
                                    </View>
                                  )}

                                  {!!reps && (
                                    <View style={styles.programMetaChip}>
                                      <Text selectable={false} style={styles.programMetaChipText}>חזרות: {reps}</Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              {!!notes && (
                                <Text style={styles.programExerciseNotes}>{notes}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyProgramText}>לא נמצאה תוכנית אימון</Text>
                )}

                {!!String(trainingProgram?.notes || '').trim() && (
                  <View style={styles.generalNotesCard}>
                    <Text style={styles.generalNotesTitle}>הערות כלליות</Text>
                    <Text style={styles.generalNotesText}>{trainingProgram?.notes}</Text>
                  </View>
                )}
              </ScrollView>
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
    position: 'relative',
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
    marginTop: 10,
    color: '#64748B',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  trainingProgramLoader: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  trainingProgramButton: {
    width: '100%',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    paddingHorizontal: 14,
  },

  trainingProgramButtonText: {
    color: '#0C4A6E',
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  section: {
    width: '100%',
    marginBottom: 18,
  },

  label: {
    color: '#334155',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
    writingDirection: 'rtl',
  },

  inputBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },

  textInput: {
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  exerciseNameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    overflow: 'hidden',
    position: 'relative',
  },

  exerciseNameInputWrapFocused: {
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },

  exerciseNameTextInput: {
    flex: 1,
    minHeight: '100%',
    paddingHorizontal: 8,
    paddingVertical: 0,
    color: '#111827',
    backgroundColor: 'transparent',
    borderWidth: 0,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    ...(Platform.OS === 'web'
      ? ({
          outlineWidth: 0,
          outlineStyle: 'none',
        } as any)
      : null),
  },

  clearInsideButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -15 }],
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginLeft: 4,
    ...(Platform.OS === 'web'
      ? ({
          outlineWidth: 0,
          outlineStyle: 'none',
          cursor: 'pointer',
        } as any)
      : null),
  },

  clearInsideButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({
          userSelect: 'none',
        } as any)
      : null),
  },

  pressedButton: {
    opacity: 0.8,
  },

  dateField: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateFieldPressed: {
    opacity: 0.85,
  },

  dateFieldRight: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 12,
  },

  dateValue: {
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right',
  },

  dateHint: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  exerciseRow: {
    width: '100%',
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
  },

  iconButton: {
    width: 58,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },

  fullWidthButtonOnSmall: {
    width: '100%',
  },

  suggestionsContainer: {
    marginTop: 8,
    maxHeight: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  suggestionText: {
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  errorText: {
    marginTop: 8,
    color: '#DC2626',
    textAlign: 'right',
    fontWeight: '600',
    writingDirection: 'rtl',
  },

  setCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
  },

  setTitle: {
    color: '#0F172A',
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 10,
    writingDirection: 'rtl',
  },

  setInputsRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 10,
  },

  setInputsColumn: {
    flexDirection: 'column',
  },

  setInputWrapper: {
    flex: 1,
  },

  miniLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 6,
    writingDirection: 'rtl',
  },

  smallInput: {
    width: '100%',
  },

  saveButton: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#0F172A',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  disabledButton: {
    opacity: 0.6,
  },

  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  dateModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
  },

  dateModalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  dateModalButton: {
    minWidth: 110,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  dateModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  iosButtonsRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },

  iosHalfButton: {
    flex: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    position: 'relative',
  },

  modalClose: {
    alignSelf: 'flex-start',
    padding: 4,
  },

  modalTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 4,
  },

  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },

  modalRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },

  modalText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  programModalCard: {
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
  },

  programHeaderRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  programModalTitle: {
    flex: 1,
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  programScrollContent: {
    paddingBottom: 12,
  },

  programSectionCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },

  programSectionTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 10,
  },

  programExerciseCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },

  programExerciseHeader: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },

  programExerciseName: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },





  programMetaRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  programMetaChip: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  programMetaChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  programExerciseNotes: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  emptyProgramText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingVertical: 12,
  },

  generalNotesCard: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
  },

  generalNotesTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
  },

  generalNotesText: {
    color: '#78350F',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },


  menuButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeTimerChip: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },

  activeTimerText: {
    color: '#3730A3',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  sideMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },

  sideMenuCard: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: 54,
    paddingHorizontal: 18,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  sideMenuHeader: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  sideMenuClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sideMenuTitle: {
    flex: 1,
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  timerMenuButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },

  timerMenuButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  timerModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },

  timerModalHeader: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  timerModalTitle: {
    flex: 1,
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  timerDisplay: {
    marginTop: 18,
    color: '#0F172A',
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
  },

  timerHint: {
    marginTop: 6,
    marginBottom: 18,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  timerInputsRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 10,
  },

  timerInputBlock: {
    flex: 1,
  },

  timerInput: {
    minHeight: 52,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  startTimerButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  startTimerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  timerActionsRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 10,
  },

  secondaryTimerButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryTimerButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

});