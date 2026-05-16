import DateTimePicker from '@react-native-community/datetimepicker';
import { useFonts } from 'expo-font';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
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

const APP_BG = '#0B0B0D';
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

const safeFirestoreId = (value: string) =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 420) || `id_${Date.now()}`;

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
  clientSucceeded?: boolean | null;
  clientNotes?: string;
  clientUpdatedAt?: string;
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

type ProgramStrengthSetEntry = {
  reps: string;
  weight: string;
};

type ProgramStrengthEntry = {
  setsCount: string;
  sets: ProgramStrengthSetEntry[];
  clientSucceeded: boolean | null;
  clientNotes: string;
  notesOpen: boolean;
  saved: boolean;
  isEditing: boolean;
  savedWorkoutId?: string;
  savedAt?: string;
  savedDateKey?: string;
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

type RunningPaceType = 'steady' | 'intervals';
type RunningManipulationType =
  | 'volume'
  | 'fartlek'
  | 'tempo'
  | 'threshold'
  | 'intervals'
  | 'recovery'
  | 'hills';
type ProgramViewType = 'strength' | 'running';
type StrengthProgramDisplayMode = 'all' | 'ordered';
type TimerModeType = 'choice' | 'rest' | 'workout';

type RunningWeek = {
  id?: string;
  weekNumber?: number;
  distanceKm?: string;
  pacePerKm?: string;
  paceType?: RunningPaceType;
  manipulationType?: RunningManipulationType;
  notes?: string;
  clientSucceeded?: boolean | null;
  clientNotes?: string;
  clientUpdatedAt?: string;
  coachFeedback?: string;
  coachFeedbackUpdatedAt?: string;
};

type RunningProgramSnapshot = {
  id?: string;
  title?: string;
  createdAt?: string;
  archivedAt?: string;
  completedAt?: string;
  runningWeeks?: RunningWeek[];
  runningWeeksCount?: number;
  notes?: string;
};

type TrainingProgramDoc = {
  clientUid?: string;
  clientName?: string;
  clientEmail?: string;
  sections?: TrainingProgramSection[];
  notes?: string;
  strengthNotes?: string;
  runningNotes?: string;
  exerciseHistory?: string[];
  updatedAt?: string;
  programType?: ProgramViewType;
  runningWeeks?: RunningWeek[];
  runningWeeksCount?: number;
  activeRunningProgramId?: string;
  runningProgramStartedAt?: string;
  runningProgramCompletedAt?: string;
  runningProgramHistory?: RunningProgramSnapshot[];
  strengthOrderedDayIndex?: number;
  strengthOrderedCompletedKeys?: string[];
};

const getPaceTypeLabel = (value?: RunningPaceType) => {
  if (value === 'intervals') return 'קצב משתנה בין מהיר לקל';
  return 'קצב קבוע';
};

const getManipulationLabel = (value?: RunningManipulationType | string) => {
  if (value === 'volume') return 'ריצת נפח';
  if (value === 'fartlek') return 'ריצת פארטלק';
  if (value === 'tempo' || value === 'quality') return 'ריצת טמפו';
  if (value === 'threshold') return 'ריצת טראשהולד';
  if (value === 'intervals') return 'אינטרוולים';
  if (value === 'recovery') return 'ריצת התאוששות';
  if (value === 'hills') return 'עליות';
  return '';
};


const isRunningWeekCompleted = (week?: RunningWeek | null) =>
  week?.clientSucceeded === true || week?.clientSucceeded === false;

const isRunningWeekSavedCompleted = (week?: RunningWeek | null) =>
  isRunningWeekCompleted(week) && String(week?.clientUpdatedAt || '').trim().length > 0;

const getRunningWeekId = (week: Partial<RunningWeek> | undefined, index: number) => {
  const weekNumber = Number(week?.weekNumber || index + 1);
  return String(week?.id || `running-week-${weekNumber}`);
};

const buildNormalizedRunningWeeks = (program?: TrainingProgramDoc | null) => {
  const rawWeeks = Array.isArray(program?.runningWeeks) ? program?.runningWeeks || [] : [];
  const plannedCount = Math.max(Number(program?.runningWeeksCount || 0), rawWeeks.length);

  return Array.from({ length: plannedCount }, (_, index) => {
    const weekNumber = index + 1;
    const existing =
      rawWeeks.find((week) => Number(week?.weekNumber || 0) === weekNumber) ||
      rawWeeks[index] ||
      {};

    return {
      ...existing,
      id: getRunningWeekId(existing, index),
      weekNumber,
    } as RunningWeek;
  });
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

function CalendarIcon({ size = 22, color = '#FF7A00' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="5" width="18" height="16" rx="3" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth={2} />
      <Line x1="8" y1="3" x2="8" y2="7" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CloseIcon({ size = 24, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function MenuIcon({ size = 26, color = '#FFFFFF' }) {
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

function WriteIcon({ size = 18, color = '#FF7A00' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0 0-3L17.5 5a2.1 2.1 0 0 0-3 0L4 15.5V20z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Line x1="13.5" y1="6" x2="18" y2="10.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="4" y1="20" x2="20" y2="20" stroke={color} strokeWidth={2} strokeLinecap="round" />
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
  const [loadingLastExerciseName, setLoadingLastExerciseName] = useState<string | null>(null);
  const [lastExerciseData, setLastExerciseData] = useState<Record<string, LastExerciseRow[]>>({});
  const [selectedExerciseForModal, setSelectedExerciseForModal] = useState<string | null>(null);
  const [isExerciseNameFocused, setIsExerciseNameFocused] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerModeType>('choice');
  const [timerMinutes, setTimerMinutes] = useState('1');
  const [timerSeconds, setTimerSeconds] = useState('30');
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [workoutTimerElapsed, setWorkoutTimerElapsed] = useState(0);
  const [isWorkoutTimerRunning, setIsWorkoutTimerRunning] = useState(false);
  const [exerciseSucceeded, setExerciseSucceeded] = useState<boolean | null>(null);
  const [exerciseClientNotes, setExerciseClientNotes] = useState('');
  const [savingRunningWeekId, setSavingRunningWeekId] = useState<string | null>(null);
  const [programStrengthEntries, setProgramStrengthEntries] = useState<Record<string, ProgramStrengthEntry>>({});
  const [savingProgramStrengthExerciseKey, setSavingProgramStrengthExerciseKey] = useState<string | null>(null);

  const [trainingProgram, setTrainingProgram] = useState<TrainingProgramDoc | null>(null);
  const [isLoadingTrainingProgram, setIsLoadingTrainingProgram] = useState(true);
  const [showTrainingProgramModal, setShowTrainingProgramModal] = useState(false);
  const [selectedProgramView, setSelectedProgramView] = useState<ProgramViewType | null>(null);
  const [strengthDisplayMode, setStrengthDisplayMode] = useState<StrengthProgramDisplayMode>('all');
  const [orderedStrengthDayIndex, setOrderedStrengthDayIndex] = useState(0);
  const [showStrengthDisplayControls, setShowStrengthDisplayControls] = useState(true);
  const [expandedProgramExerciseKeys, setExpandedProgramExerciseKeys] = useState<Record<string, boolean>>({});
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

  const hasStrengthProgramContent = useMemo(() => {
    if (!trainingProgram) return false;

    const sections = Array.isArray(trainingProgram.sections) ? trainingProgram.sections : [];

    return sections.some((section) => {
      const title = String(section?.title || '').trim();
      const exercises = Array.isArray(section?.exercises) ? section.exercises : [];

      const hasExercises = exercises.some((item) => (
        String(item?.name || '').trim() ||
        String(item?.sets || '').trim() ||
        String(item?.reps || '').trim() ||
        String(item?.notes || '').trim()
      ));

      return !!title || hasExercises;
    });
  }, [trainingProgram, date]);

  const hasRunningProgramContent = useMemo(() => {
    if (!trainingProgram) return false;

    const runningWeeks = Array.isArray(trainingProgram.runningWeeks) ? trainingProgram.runningWeeks : [];
    if (Number(trainingProgram.runningWeeksCount || 0) > 0 || runningWeeks.length > 0) return true;

    return runningWeeks.some((week) => (
      String(week?.distanceKm || '').trim() ||
      String(week?.pacePerKm || '').trim() ||
      String(week?.notes || '').trim() ||
      !!week?.paceType ||
      !!week?.manipulationType
    ));
  }, [trainingProgram]);

  const strengthGeneralNotes = useMemo(() =>
    String(trainingProgram?.strengthNotes || trainingProgram?.notes || '').trim(),
    [trainingProgram]
  );

  const runningGeneralNotes = useMemo(() =>
    String(trainingProgram?.runningNotes || trainingProgram?.notes || '').trim(),
    [trainingProgram]
  );

  const hasGeneralTrainingNotes = strengthGeneralNotes.length > 0 || runningGeneralNotes.length > 0;

  const hasTrainingProgramContent = hasStrengthProgramContent || hasRunningProgramContent || hasGeneralTrainingNotes;

  const openTrainingProgramModal = useCallback(() => {
    if (hasStrengthProgramContent && !hasRunningProgramContent) {
      setSelectedProgramView('strength');
    } else if (hasRunningProgramContent && !hasStrengthProgramContent) {
      setSelectedProgramView('running');
    } else {
      setSelectedProgramView(null);
    }

    setExpandedProgramExerciseKeys({});
    setShowTrainingProgramModal(true);
  }, [hasRunningProgramContent, hasStrengthProgramContent]);

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
      setOrderedStrengthDayIndex(
        Math.max(0, Number(data?.strengthOrderedDayIndex || 0) || 0)
      );
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

  const isSameExerciseName = (value: any, normalizedTarget: string, allowLoose = false) => {
    const normalizedValue = normalizeText(String(value || ''));
    if (!normalizedValue || !normalizedTarget) return false;
    if (normalizedValue === normalizedTarget) return true;

    // גיבוי למקרים שבהם במסד נשמר שם עם רווח/תיאור נוסף מתוך תוכנית המאמן.
    return allowLoose && (
      normalizedValue.includes(normalizedTarget) || normalizedTarget.includes(normalizedValue)
    );
  };

  const buildLastRowsFromRepsPerSet = (repsPerSet: any): LastExerciseRow[] => {
    if (!repsPerSet || typeof repsPerSet !== 'object') return [];

    return Object.keys(repsPerSet)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => ({
        sets: Number(key) + 1,
        reps: String(repsPerSet[key]?.reps ?? ''),
        weight: String(repsPerSet[key]?.weight ?? ''),
      }))
      .filter((row) => row.reps.trim() || row.weight.trim());
  };

  const fetchLastExercise = async (exerciseName: string) => {
    const trimmedExerciseName = String(exerciseName || '').trim();

    try {
      const user = auth.currentUser;
      if (!user || !trimmedExerciseName) return [];

      const normalizedTarget = normalizeText(trimmedExerciseName);

      if (deletedExerciseNames.has(normalizedTarget)) {
        setLastExerciseData((prev) => ({
          ...prev,
          [trimmedExerciseName]: [],
        }));
        return [];
      }

      setIsLoadingLastExercise(true);
      setLoadingLastExerciseName(trimmedExerciseName);

      const [workoutsSnapshot, exercisesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'workouts'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'exercises'), where('uid', '==', user.uid))),
      ]);

      const allWorkouts = workoutsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() || {}),
      }));

      const exactWorkoutMatches = allWorkouts.filter((item: any) =>
        isSameExerciseName(getExerciseNameFromDoc(item), normalizedTarget)
      );

      const workoutMatches = exactWorkoutMatches.length > 0
        ? exactWorkoutMatches
        : allWorkouts.filter((item: any) =>
            isSameExerciseName(getExerciseNameFromDoc(item), normalizedTarget, true)
          );

      const sortedWorkoutMatches = workoutMatches.sort((a: any, b: any) => {
        const aTime =
          parseDateSafe(a.clientUpdatedAt)?.getTime() ||
          parseDateSafe(a.updatedAt)?.getTime() ||
          parseDateSafe(a.createdAt)?.getTime() ||
          parseDateSafe(a.date)?.getTime() ||
          0;

        const bTime =
          parseDateSafe(b.clientUpdatedAt)?.getTime() ||
          parseDateSafe(b.updatedAt)?.getTime() ||
          parseDateSafe(b.createdAt)?.getTime() ||
          parseDateSafe(b.date)?.getTime() ||
          0;

        return bTime - aTime;
      });

      for (const latestWorkout of sortedWorkoutMatches) {
        const rows = buildLastRowsFromRepsPerSet((latestWorkout as any)?.repsPerSet);
        if (rows.length > 0) {
          setLastExerciseData((prev) => ({
            ...prev,
            [trimmedExerciseName]: rows,
          }));
          return rows;
        }
      }

      // גיבוי חשוב: באימונים ישנים לפעמים הסטים נשמרו רק בקולקציית exercises ולא בתוך repsPerSet ב־workouts.
      const allExerciseRows = exercisesSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() || {}),
      }));

      const exactExerciseRows = allExerciseRows.filter((item: any) =>
        isSameExerciseName(getExerciseNameFromDoc(item), normalizedTarget)
      );

      const matchedExerciseRows = exactExerciseRows.length > 0
        ? exactExerciseRows
        : allExerciseRows.filter((item: any) =>
            isSameExerciseName(getExerciseNameFromDoc(item), normalizedTarget, true)
          );

      const groupedRows = matchedExerciseRows.reduce<Record<string, any[]>>((acc, row: any) => {
        const groupKey = String(
          row.workoutId ||
          row.clientEntryOrder ||
          row.exerciseOrder ||
          row.dateKey ||
          row.date ||
          row.createdAt ||
          row.id
        );

        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(row);
        return acc;
      }, {});

      const latestGroup = Object.values(groupedRows)
        .sort((a: any[], b: any[]) => {
          const getGroupTime = (rows: any[]) => Math.max(
            ...rows.map((row) =>
              parseDateSafe(row.clientUpdatedAt)?.getTime() ||
              parseDateSafe(row.updatedAt)?.getTime() ||
              parseDateSafe(row.createdAt)?.getTime() ||
              parseDateSafe(row.date)?.getTime() ||
              0
            )
          );

          return getGroupTime(b) - getGroupTime(a);
        })[0] || [];

      const rowsFromExercises = latestGroup
        .sort((a: any, b: any) => Number(a.setOrder || a.sets || a.order || 0) - Number(b.setOrder || b.sets || b.order || 0))
        .map((row: any, index: number) => ({
          sets: Number(row.setOrder || row.sets || row.order || index + 1),
          reps: String(row.reps ?? ''),
          weight: String(row.weight ?? ''),
        }))
        .filter((row: LastExerciseRow) => row.reps.trim() || row.weight.trim());

      setLastExerciseData((prev) => ({
        ...prev,
        [trimmedExerciseName]: rowsFromExercises,
      }));

      return rowsFromExercises;
    } catch (error) {
      console.error('שגיאה בשליפת האימון האחרון:', error);
      setLastExerciseData((prev) => ({
        ...prev,
        [trimmedExerciseName]: [],
      }));
      return [];
    } finally {
      setIsLoadingLastExercise(false);
      setLoadingLastExerciseName(null);
    }
  };

  const openLastExerciseModal = async (exerciseName: string) => {
    const trimmedName = String(exerciseName || '').trim();

    if (!trimmedName || isLoadingLastExercise) return;

    await fetchLastExercise(trimmedName);
    setSelectedExerciseForModal(trimmedName);
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
        clientSucceeded: exerciseSucceeded,
        clientNotes: exerciseClientNotes.trim(),
        clientUpdatedAt: nowIso,
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
            clientSucceeded: exerciseSucceeded,
            clientNotes: exerciseClientNotes.trim(),
            clientUpdatedAt: nowIso,
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
      setExerciseSucceeded(null);
      setExerciseClientNotes('');
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

  useEffect(() => {
    if (!isWorkoutTimerRunning) return;

    const intervalId = setInterval(() => {
      setWorkoutTimerElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isWorkoutTimerRunning]);

  const formatTimer = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatWorkoutTimer = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, totalSeconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const openTimerFromMenu = () => {
    setShowSideMenu(false);
    setTimerMode('choice');
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

  const startWorkoutTimer = () => {
    setIsWorkoutTimerRunning(true);
  };

  const pauseOrResumeWorkoutTimer = () => {
    if (workoutTimerElapsed <= 0) return;
    setIsWorkoutTimerRunning((prev) => !prev);
  };

  const resetWorkoutTimer = () => {
    setIsWorkoutTimerRunning(false);
    setWorkoutTimerElapsed(0);
  };


  const getProgramStrengthExerciseKey = (
    sectionIndex: number,
    exerciseIndex: number,
    item?: TrainingProgramExercise | null
  ) => {
    const rawId = String(item?.id || '').trim();
    if (rawId) return `program-strength-${rawId}`;
    return `program-strength-${sectionIndex}-${exerciseIndex}-${normalizeText(item?.name || '')}`;
  };

  const getProgramSetsCount = (item?: TrainingProgramExercise | null) => {
    const parsed = parseInt(String(item?.sets || '').replace(/[^0-9]/g, ''), 10);
    return Math.max(1, Math.min(20, Number.isFinite(parsed) && parsed > 0 ? parsed : 1));
  };

  const buildDefaultProgramStrengthEntry = (item?: TrainingProgramExercise | null): ProgramStrengthEntry => {
    const plannedSetsCount = getProgramSetsCount(item);
    const plannedReps = String(item?.reps || '').trim();

    return {
      setsCount: String(plannedSetsCount),
      sets: Array.from({ length: plannedSetsCount }).map(() => ({
        reps: plannedReps,
        weight: '',
      })),
      clientSucceeded: null,
      clientNotes: '',
      notesOpen: false,
      saved: false,
      isEditing: true,
    };
  };

  const normalizeProgramStrengthEntry = (
    entry: ProgramStrengthEntry | undefined,
    item?: TrainingProgramExercise | null
  ): ProgramStrengthEntry => {
    const fallback = buildDefaultProgramStrengthEntry(item);
    if (!entry) return fallback;

    const parsedCount = parseInt(String(entry.setsCount || '').replace(/[^0-9]/g, ''), 10);
    const setsCount = Math.max(1, Math.min(20, Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : fallback.sets.length));
    const currentSets = Array.isArray(entry.sets) ? entry.sets : [];
    const nextSets = Array.from({ length: setsCount }).map((_, index) => ({
      reps: String(currentSets[index]?.reps ?? fallback.sets[index]?.reps ?? '').trim(),
      weight: String(currentSets[index]?.weight ?? fallback.sets[index]?.weight ?? '').trim(),
    }));

    return {
      ...fallback,
      ...entry,
      setsCount: String(setsCount),
      sets: nextSets,
      clientSucceeded: entry.clientSucceeded === true || entry.clientSucceeded === false ? entry.clientSucceeded : null,
      clientNotes: String(entry.clientNotes || ''),
      notesOpen: !!entry.notesOpen,
      saved: !!entry.saved,
      isEditing: entry.saved ? !!entry.isEditing : true,
    };
  };

  const getProgramStrengthEntry = (key: string, item?: TrainingProgramExercise | null): ProgramStrengthEntry => {
    return normalizeProgramStrengthEntry(programStrengthEntries[key], item);
  };

  const updateProgramStrengthEntry = (
    key: string,
    patch: Partial<ProgramStrengthEntry>,
    item?: TrainingProgramExercise | null
  ) => {
    setProgramStrengthEntries((prev) => ({
      ...prev,
      [key]: normalizeProgramStrengthEntry(
        {
          ...(prev[key] || buildDefaultProgramStrengthEntry(item)),
          ...patch,
        },
        item
      ),
    }));
  };

  const updateProgramStrengthSetsCount = (
    key: string,
    value: string,
    item?: TrainingProgramExercise | null
  ) => {
    const cleanedValue = value.replace(/[^0-9]/g, '');
    const nextCount = Math.max(1, Math.min(20, parseInt(cleanedValue || '1', 10) || 1));

    setProgramStrengthEntries((prev) => {
      const current = normalizeProgramStrengthEntry(prev[key], item);
      const defaultEntry = buildDefaultProgramStrengthEntry(item);
      const nextSets = Array.from({ length: nextCount }).map((_, index) => ({
        reps: String(current.sets[index]?.reps ?? defaultEntry.sets[index]?.reps ?? '').trim(),
        weight: String(current.sets[index]?.weight ?? '').trim(),
      }));

      return {
        ...prev,
        [key]: {
          ...current,
          setsCount: String(nextCount),
          sets: nextSets,
          isEditing: true,
        },
      };
    });
  };

  const updateProgramStrengthSetField = (
    key: string,
    setIndex: number,
    field: keyof ProgramStrengthSetEntry,
    value: string,
    item?: TrainingProgramExercise | null
  ) => {
    const cleanedValue = field === 'weight'
      ? value.replace(/[^0-9.]/g, '')
      : value.replace(/[^0-9]/g, '');

    setProgramStrengthEntries((prev) => {
      const current = normalizeProgramStrengthEntry(prev[key], item);
      const nextSets = current.sets.map((set, index) =>
        index === setIndex ? { ...set, [field]: cleanedValue } : set
      );

      return {
        ...prev,
        [key]: {
          ...current,
          sets: nextSets,
          isEditing: true,
        },
      };
    });
  };

  const enableProgramStrengthExerciseEdit = (key: string, item?: TrainingProgramExercise | null) => {
    setProgramStrengthEntries((prev) => ({
      ...prev,
      [key]: {
        ...normalizeProgramStrengthEntry(prev[key], item),
        isEditing: true,
      },
    }));
  };

  const loadSavedProgramStrengthEntries = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !trainingProgram) return;

    const sections = Array.isArray(trainingProgram.sections) ? trainingProgram.sections : [];
    const activeDateKey = formatDateForInput(date);

    if (sections.length === 0) {
      setProgramStrengthEntries({});
      return;
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'workouts'),
          where('uid', '==', user.uid),
          where('source', '==', 'trainingProgram'),
          where('dateKey', '==', activeDateKey)
        )
      );

      const latestByKey: Record<string, any> = {};

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const stableKey = String(
          data.programStrengthEntryKey ||
            (data.programExerciseId ? `program-strength-${data.programExerciseId}` : '')
        ).trim();

        if (!stableKey) return;

        const existing = latestByKey[stableKey];
        const currentTime = parseDateSafe(data.clientUpdatedAt)?.getTime() || parseDateSafe(data.updatedAt)?.getTime() || parseDateSafe(data.createdAt)?.getTime() || 0;
        const existingTime = existing
          ? parseDateSafe(existing.clientUpdatedAt)?.getTime() || parseDateSafe(existing.updatedAt)?.getTime() || parseDateSafe(existing.createdAt)?.getTime() || 0
          : 0;

        if (!existing || currentTime >= existingTime) {
          latestByKey[stableKey] = { id: docSnap.id, ...data };
        }
      });

      setProgramStrengthEntries((prev) => {
        const next: Record<string, ProgramStrengthEntry> = {};

        // שומרים רק פתיחה/סגירה של תיבת הפירוט מהסטייט המקומי,
        // אבל לא משאירים נתוני ביצוע מיום קודם.
        const notesOpenByKey = Object.keys(prev).reduce<Record<string, boolean>>((acc, entryKey) => {
          acc[entryKey] = !!prev[entryKey]?.notesOpen;
          return acc;
        }, {});

        sections.forEach((section, sectionIndex) => {
          const exercises = Array.isArray(section?.exercises) ? section.exercises : [];

          exercises.forEach((item, exerciseIndex) => {
            const key = getProgramStrengthExerciseKey(sectionIndex, exerciseIndex, item);
            const savedWorkout = latestByKey[key];
            if (!savedWorkout) return;

            const repsPerSet = savedWorkout.repsPerSet && typeof savedWorkout.repsPerSet === 'object'
              ? savedWorkout.repsPerSet
              : {};
            const setKeys = Object.keys(repsPerSet).sort((a, b) => Number(a) - Number(b));
            const fallback = buildDefaultProgramStrengthEntry(item);
            const sets = setKeys.length > 0
              ? setKeys.map((setKey) => ({
                  reps: String(repsPerSet[setKey]?.reps ?? '').replace(/[^0-9]/g, ''),
                  weight: String(repsPerSet[setKey]?.weight ?? '').replace(/[^0-9.]/g, ''),
                }))
              : fallback.sets;

            next[key] = normalizeProgramStrengthEntry(
              {
                setsCount: String(sets.length),
                sets,
                clientSucceeded:
                  savedWorkout.clientSucceeded === true || savedWorkout.clientSucceeded === false
                    ? savedWorkout.clientSucceeded
                    : null,
                clientNotes: String(savedWorkout.clientNotes || ''),
                notesOpen: notesOpenByKey[key] || false,
                saved: true,
                isEditing: false,
                savedWorkoutId: savedWorkout.id,
                savedAt: String(savedWorkout.createdAt || savedWorkout.clientUpdatedAt || savedWorkout.updatedAt || ''),
                savedDateKey: activeDateKey,
              },
              item
            );
          });
        });

        return next;
      });
    } catch (error) {
      console.error('שגיאה בטעינת ביצועי כוח מתוך תוכנית:', error);
    }
  }, [trainingProgram, date]);

  useEffect(() => {
    loadSavedProgramStrengthEntries();
  }, [loadSavedProgramStrengthEntries]);

  const saveProgramStrengthExercise = async (
    key: string,
    item?: TrainingProgramExercise | null,
    sectionTitle?: string,
    sectionIndexForOrderedMode?: number
  ) => {
    if (isSaving || savingProgramStrengthExerciseKey) return;

    const user = auth.currentUser;
    if (!user) {
      showToast('לא נמצא משתמש מחובר');
      return;
    }

    const exerciseName = String(item?.name || '').trim();
    if (!exerciseName) {
      showToast('לא נמצא שם תרגיל לשמירה');
      return;
    }

    const entry = getProgramStrengthEntry(key, item);
    const stableProgramStrengthEntryKey = String(key || '').trim();
    if (entry.saved && !entry.isEditing) {
      showToast('התרגיל כבר נשמר. כדי לשנות יש ללחוץ על עריכת ביצוע');
      return;
    }

    const cleanedSets = entry.sets.map((set, index) => ({
      setOrder: index + 1,
      reps: String(set.reps || '').replace(/[^0-9]/g, ''),
      weight: String(set.weight || '').replace(/[^0-9.]/g, ''),
    }));

    if (cleanedSets.length === 0 || cleanedSets.some((set) => !set.reps)) {
      showToast('יש להזין חזרות לכל סט לפני שמירה');
      return;
    }

    try {
      setSavingProgramStrengthExerciseKey(key);
      const normalizedName = normalizeText(exerciseName);
      const now = new Date();
      const nowIso = now.toISOString();
      const dateKey = formatDateForInput(date);
      const workoutDateIso = date.toISOString();
      const isSavedForCurrentDate = entry.saved && entry.savedDateKey === dateKey;
      const clientEntryOrder = isSavedForCurrentDate && entry.savedAt
        ? Number(new Date(entry.savedAt).getTime() || now.getTime())
        : now.getTime();

      await removeOldDeletedCopiesIfExist(user.uid, exerciseName);

      const repsPerSetForWorkout: RepsPerSetType = cleanedSets.reduce(
        (acc: RepsPerSetType, set, index) => {
          acc[String(index)] = {
            reps: set.reps,
            weight: set.weight,
          };
          return acc;
        },
        {}
      );

      const workoutPayload: WorkoutDocType & Record<string, any> = {
        uid: user.uid,
        title: exerciseName,
        name: exerciseName,
        exerciseName,
        date: workoutDateIso,
        dateKey,
        createdAt: isSavedForCurrentDate ? entry.savedAt || nowIso : nowIso,
        updatedAt: nowIso,
        order: clientEntryOrder,
        exerciseOrder: clientEntryOrder,
        clientEntryOrder,
        enteredByClient: true,
        clientSucceeded: entry.clientSucceeded,
        clientNotes: entry.clientNotes.trim(),
        clientUpdatedAt: nowIso,
        numSets: cleanedSets.length,
        repsPerSet: repsPerSetForWorkout,
        source: 'trainingProgram',
        programStrengthEntryKey: stableProgramStrengthEntryKey,
        programExerciseId: String(item?.id || ''),
        programSectionTitle: String(sectionTitle || ''),
      };

      let workoutId = isSavedForCurrentDate ? entry.savedWorkoutId || '' : '';

      if (!workoutId && stableProgramStrengthEntryKey) {
        const existingWorkoutSnap = await getDocs(
          query(
            collection(db, 'workouts'),
            where('uid', '==', user.uid),
            where('source', '==', 'trainingProgram'),
            where('programStrengthEntryKey', '==', stableProgramStrengthEntryKey),
            where('dateKey', '==', dateKey)
          )
        );

        if (!existingWorkoutSnap.empty) {
          const latestExisting = existingWorkoutSnap.docs
            .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
            .sort((a: any, b: any) => {
              const bTime = parseDateSafe(b.clientUpdatedAt)?.getTime() || parseDateSafe(b.updatedAt)?.getTime() || parseDateSafe(b.createdAt)?.getTime() || 0;
              const aTime = parseDateSafe(a.clientUpdatedAt)?.getTime() || parseDateSafe(a.updatedAt)?.getTime() || parseDateSafe(a.createdAt)?.getTime() || 0;
              return bTime - aTime;
            })[0];

          workoutId = latestExisting.id;
        }
      }

      if (!workoutId) {
        workoutId = `program_strength_${safeFirestoreId(user.uid)}_${safeFirestoreId(stableProgramStrengthEntryKey)}_${safeFirestoreId(dateKey)}`;
      }

      // שמירה דטרמיניסטית: עריכה של סטים/חזרות/משקל מעדכנת את אותה רשומת אימון
      // ולכן המעקב של המאמן לא נשאר עם נתוני סטים ישנים.
      await setDoc(doc(db, 'workouts', workoutId), workoutPayload, { merge: true });

      const previousExerciseRowsByWorkout = await getDocs(
        query(collection(db, 'exercises'), where('workoutId', '==', workoutId))
      );
      const previousExerciseRowsByProgramKey = stableProgramStrengthEntryKey
        ? await getDocs(
            query(
              collection(db, 'exercises'),
              where('uid', '==', user.uid),
              where('source', '==', 'trainingProgram'),
              where('programStrengthEntryKey', '==', stableProgramStrengthEntryKey),
              where('dateKey', '==', dateKey)
            )
          )
        : null;

      const docsToDelete = new Map<string, true>();
      previousExerciseRowsByWorkout.docs.forEach((docSnap) => docsToDelete.set(docSnap.id, true));
      previousExerciseRowsByProgramKey?.docs.forEach((docSnap) => docsToDelete.set(docSnap.id, true));

      await Promise.all(
        Array.from(docsToDelete.keys()).map((exerciseDocId) =>
          deleteDoc(doc(db, 'exercises', exerciseDocId))
        )
      );

      await Promise.all(
        cleanedSets.map((set) =>
          setDoc(doc(db, 'exercises', `${safeFirestoreId(workoutId)}_set_${set.setOrder}`), {
            uid: user.uid,
            workoutId,
            exerciseName,
            name: exerciseName,
            title: exerciseName,
            sets: set.setOrder,
            reps: Number(set.reps || 0),
            weight: Number(set.weight || 0),
            date: workoutDateIso,
            dateKey,
            createdAt: isSavedForCurrentDate ? entry.savedAt || nowIso : nowIso,
            updatedAt: nowIso,
            order: set.setOrder,
            exerciseOrder: clientEntryOrder,
            setOrder: set.setOrder,
            clientEntryOrder,
            enteredByClient: true,
            clientSucceeded: entry.clientSucceeded,
            clientNotes: entry.clientNotes.trim(),
            clientUpdatedAt: nowIso,
            source: 'trainingProgram',
            programStrengthEntryKey: stableProgramStrengthEntryKey,
            programExerciseId: String(item?.id || ''),
            programSectionTitle: String(sectionTitle || ''),
          }, { merge: true })
        )
      );

      setExistingExercises((prev) => {
        const withoutOldDuplicates = prev.filter((name) => normalizeText(name) !== normalizedName);
        return [...withoutOldDuplicates, exerciseName].sort((a, b) => a.localeCompare(b, 'he'));
      });

      setLastExerciseData((prev) => ({
        ...prev,
        [exerciseName]: cleanedSets.map((set) => ({
          sets: set.setOrder,
          reps: set.reps,
          weight: set.weight,
        })),
      }));

      setProgramStrengthEntries((prev) => ({
        ...prev,
        [key]: {
          ...entry,
          setsCount: String(cleanedSets.length),
          sets: cleanedSets.map((set) => ({ reps: set.reps, weight: set.weight })),
          saved: true,
          isEditing: false,
          savedWorkoutId: workoutId,
          savedAt: isSavedForCurrentDate ? entry.savedAt || nowIso : nowIso,
          savedDateKey: dateKey,
          clientSucceeded: entry.clientSucceeded,
          clientNotes: entry.clientNotes,
          notesOpen: !!entry.notesOpen,
        },
      }));

      setExpandedProgramExerciseKeys((prev) => ({
        ...prev,
        [key]: false,
      }));

      await fetchUserData();

      const shouldTryAdvanceOrderedDay =
        strengthDisplayMode === 'ordered' &&
        isSplitStrengthProgram &&
        typeof sectionIndexForOrderedMode === 'number' &&
        sectionIndexForOrderedMode === safeOrderedStrengthDayIndex;

      if (shouldTryAdvanceOrderedDay) {
        const currentSection = trainingSections[sectionIndexForOrderedMode];
        const currentSectionExercises = Array.isArray(currentSection?.exercises)
          ? currentSection.exercises
          : [];

        const sectionExerciseKeys = currentSectionExercises
          .map((sectionExercise, index) =>
            getProgramStrengthExerciseKey(sectionIndexForOrderedMode, index, sectionExercise)
          )
          .filter(Boolean);

        const allSectionExercisesSaved =
          sectionExerciseKeys.length > 0 &&
          sectionExerciseKeys.every((sectionExerciseKey) => {
            if (sectionExerciseKey === key) return true;
            const localEntry = programStrengthEntries[sectionExerciseKey];
            return !!localEntry?.saved && !localEntry?.isEditing;
          });

        if (allSectionExercisesSaved) {
          await advanceOrderedStrengthDay();
          showToast('היום הסתיים. בפעם הבאה יוצג היום הבא בתוכנית.');
        } else {
          showToast(isSavedForCurrentDate ? 'הביצוע עודכן בהצלחה' : 'התרגיל מתוך התוכנית נשמר להיום בהצלחה');
        }
      } else {
        showToast(isSavedForCurrentDate ? 'הביצוע עודכן בהצלחה' : 'התרגיל מתוך התוכנית נשמר להיום בהצלחה');
      }
    } catch (error) {
      console.error('שגיאה בשמירת תרגיל מתוך תוכנית כוח:', error);
      showToast('לא ניתן לשמור את התרגיל מתוך התוכנית');
    } finally {
      setSavingProgramStrengthExerciseKey(null);
    }
  };

  const updateLocalRunningWeek = (weekId: string, patch: Partial<RunningWeek>) => {
    setTrainingProgram((prev) => {
      if (!prev) return prev;
      const nextWeeks = buildNormalizedRunningWeeks(prev).map((week, index) => {
        const id = getRunningWeekId(week, index);
        return id === weekId ? { ...week, id, ...patch } : { ...week, id };
      });
      return { ...prev, runningWeeks: nextWeeks, runningWeeksCount: Math.max(Number(prev.runningWeeksCount || 0), nextWeeks.length) };
    });
  };

  const saveRunningWeekFeedback = async (weekId?: string) => {
    const user = auth.currentUser;
    if (!user || !weekId || !trainingProgram) return;

    try {
      setSavingRunningWeekId(weekId);
      const nowIso = new Date().toISOString();
      const nextWeeks = buildNormalizedRunningWeeks(trainingProgram).map((week, index) => {
        const id = getRunningWeekId(week, index);
        return id === weekId ? { ...week, id, clientUpdatedAt: nowIso } : { ...week, id };
      });
      const completedAfterSave = nextWeeks.length > 0 && nextWeeks.every((week) => isRunningWeekSavedCompleted(week));

      await setDoc(
        doc(db, 'clientTrainingPrograms', user.uid),
        {
          runningWeeks: nextWeeks,
          runningWeeksCount: nextWeeks.length,
          ...(completedAfterSave ? { runningProgramCompletedAt: nowIso } : {}),
        },
        { merge: true }
      );

      setTrainingProgram((prev) =>
        prev
          ? {
              ...prev,
              runningWeeks: nextWeeks,
              runningWeeksCount: nextWeeks.length,
              ...(completedAfterSave ? { runningProgramCompletedAt: nowIso } : {}),
            }
          : prev
      );

      if (completedAfterSave) {
        showToast('כל הכבוד! סיימת את כל תוכנית הריצה. אפשר לצפות בתוכנית המלאה דרך התפריט בכפתור “תוכנית אימון”.');
      } else {
        showToast('העדכון נשמר למאמן');
      }
    } catch (error) {
      console.error('שגיאה בשמירת עדכון ריצה:', error);
      showToast('לא ניתן לשמור את העדכון');
    } finally {
      setSavingRunningWeekId(null);
    }
  };

  const toggleProgramExerciseOpen = (exerciseKey: string) => {
    setExpandedProgramExerciseKeys((prev) => ({
      ...prev,
      [exerciseKey]: !prev[exerciseKey],
    }));
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

  const trainingSections = Array.isArray(trainingProgram?.sections) ? trainingProgram.sections : [];
  const runningWeeks = buildNormalizedRunningWeeks(trainingProgram);

  const strengthDayLabels = ['A', 'B', 'C', 'D'];
  const isSplitStrengthProgram =
    trainingSections.length >= 2 &&
    trainingSections.length <= 4 &&
    trainingSections.every((section) => {
      const exercises = Array.isArray(section?.exercises) ? section.exercises : [];
      return exercises.some((item) =>
        String(item?.name || '').trim() ||
        String(item?.sets || '').trim() ||
        String(item?.reps || '').trim() ||
        String(item?.notes || '').trim()
      );
    });

  const safeOrderedStrengthDayIndex =
    trainingSections.length > 0
      ? Math.max(0, Math.min(orderedStrengthDayIndex, trainingSections.length - 1))
      : 0;

  const visibleStrengthSections =
    selectedProgramView === 'strength' && isSplitStrengthProgram && strengthDisplayMode === 'ordered'
      ? trainingSections.slice(safeOrderedStrengthDayIndex, safeOrderedStrengthDayIndex + 1)
      : trainingSections;

  const visibleStrengthStartIndex =
    selectedProgramView === 'strength' && isSplitStrengthProgram && strengthDisplayMode === 'ordered'
      ? safeOrderedStrengthDayIndex
      : 0;

  const advanceOrderedStrengthDay = async () => {
    if (!isSplitStrengthProgram || trainingSections.length === 0) return;

    const user = auth.currentUser;
    const nextIndex = (safeOrderedStrengthDayIndex + 1) % trainingSections.length;

    setOrderedStrengthDayIndex(nextIndex);

    if (user) {
      try {
        await setDoc(
          doc(db, 'clientTrainingPrograms', user.uid),
          {
            strengthOrderedDayIndex: nextIndex,
            strengthOrderedUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error('שגיאה בעדכון יום כוח לפי סדר:', error);
      }
    }
  };

  const isActiveRunningProgramCompleted =
    runningWeeks.length > 0 &&
    runningWeeks.every((week) => isRunningWeekSavedCompleted(week));

  const visibleRunningWeeksOnHome = (() => {
    if (runningWeeks.length === 0 || isActiveRunningProgramCompleted) return [] as RunningWeek[];
    const firstOpenWeek = runningWeeks.find((week) => !isRunningWeekSavedCompleted(week));
    return firstOpenWeek ? [firstOpenWeek] : [];
  })();

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
                  <MenuIcon size={26} color="#FFFFFF" />
                </Pressable>

                {(timerRemaining > 0 || workoutTimerElapsed > 0) && (
                  <View style={styles.activeTimersWrap}>
                    {timerRemaining > 0 && (
                      <Pressable
                        style={styles.activeTimerChip}
                        onPress={() => {
                          setTimerMode('rest');
                          setShowTimerModal(true);
                        }}
                      >
                        <Text style={styles.activeTimerText}>מנוחה: {formatTimer(timerRemaining)}</Text>
                      </Pressable>
                    )}

                    {workoutTimerElapsed > 0 && (
                      <Pressable
                        style={styles.activeTimerChip}
                        onPress={() => {
                          setTimerMode('workout');
                          setShowTimerModal(true);
                        }}
                      >
                        <Text style={styles.activeTimerText}>אימון: {formatWorkoutTimer(workoutTimerElapsed)}</Text>
                      </Pressable>
                    )}
                  </View>
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
                          color: '#FFFFFF',
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
                        <Text style={styles.dateHint}>לחץ כדי לשנות תאריך</Text>
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
                            paddingRight: Math.max(16, dynamic.inputHeight * 0.28),
                            paddingLeft: exercise.name.trim()
                              ? Math.max(48, dynamic.inputHeight)
                              : Math.max(12, dynamic.inputHeight * 0.22),
                          },
                        ]}
                        placeholder="שם תרגיל"
                        placeholderTextColor="#8F8F96"
                        value={exercise.name}
                        onChangeText={(text) => handleExerciseChange('name', text)}
                        textAlign="right"
                        editable={!isSaving}
                        onFocus={() => setIsExerciseNameFocused(true)}
                        onBlur={() => setIsExerciseNameFocused(false)}
                        autoCapitalize="none"
                        autoCorrect={false}
                        numberOfLines={1}
                        multiline={false}
                      />
                    </View>

                    {exercise.name.trim() !== '' && (
                      <Pressable
                        style={[
                          styles.iconButton,
                          { minHeight: dynamic.inputHeight },
                          isVerySmall && styles.fullWidthButtonOnSmall,
                        ]}
                        onPress={() => openLastExerciseModal(exercise.name)}
                        disabled={isLoadingLastExercise}
                      >
                        {isLoadingLastExercise && loadingLastExerciseName === exercise.name.trim() ? (
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
                    placeholderTextColor="#8F8F96"
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
                            placeholderTextColor="#8F8F96"
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
                            placeholderTextColor="#8F8F96"
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
          visible={showSideMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSideMenu(false)}
        >
          <Pressable style={styles.sideMenuOverlay} onPress={() => setShowSideMenu(false)}>
            <Pressable style={[styles.sideMenuCard, { width: Math.min(width * 0.78, 300) }]}>
              <View style={styles.sideMenuHeader}>
                <Pressable onPress={() => setShowSideMenu(false)} style={styles.sideMenuClose}>
                  <CloseIcon size={22} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.sideMenuTitle}>תפריט</Text>
              </View>

              {isLoadingTrainingProgram ? (
                <View style={styles.sideMenuLoaderBox}>
                  <ActivityIndicator color="#0F172A" />
                  <Text style={styles.sideMenuLoaderText}>טוען תוכנית אימון...</Text>
                </View>
              ) : hasTrainingProgramContent ? (
                <Pressable
                  style={styles.trainingProgramMenuButton}
                  onPress={() => {
                    setShowSideMenu(false);
                    openTrainingProgramModal();
                  }}
                >
                  <Text style={styles.trainingProgramMenuButtonText}>צפייה בתוכנית אימון</Text>
                </Pressable>
              ) : null}

              <Pressable style={styles.timerMenuButton} onPress={openTimerFromMenu}>
                <TimerIcon size={22} color="#FFFFFF" />
                <Text style={styles.timerMenuButtonText}>טיימרים</Text>
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
                  <CloseIcon size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.timerModalTitle}>
                  {timerMode === 'rest'
                    ? 'טיימר מנוחה'
                    : timerMode === 'workout'
                      ? 'זמן אימון'
                      : 'בחירת טיימר'}
                </Text>
              </View>

              {timerMode === 'choice' ? (
                <View style={styles.timerChoiceBox}>
                  <Text style={styles.timerHint}>בחרי איזה טיימר להפעיל</Text>

                  <Pressable style={styles.timerChoiceButton} onPress={() => setTimerMode('rest')}>
                    <TimerIcon size={22} color="#FFFFFF" />
                    <View style={styles.timerChoiceTextBlock}>
                      <Text style={styles.timerChoiceButtonText}>טיימר מנוחה</Text>
                      <Text style={styles.timerChoiceButtonSubText}>ספירה לאחור בין סטים או תרגילים</Text>
                    </View>
                  </Pressable>

                  <Pressable style={styles.timerChoiceSecondaryButton} onPress={() => setTimerMode('workout')}>
                    <TimerIcon size={22} color="#FF7A00" />
                    <View style={styles.timerChoiceTextBlock}>
                      <Text style={styles.timerChoiceSecondaryButtonText}>טיימר זמן אימון</Text>
                      <Text style={styles.timerChoiceSecondaryButtonSubText}>ספירה קדימה של כל האימון</Text>
                    </View>
                  </Pressable>
                </View>
              ) : timerMode === 'rest' ? (
                <>
                  <Text style={styles.timerDisplay}>{formatTimer(timerRemaining)}</Text>
                  <Text style={styles.timerHint}>הגדירי זמן מנוחה ידני בין תרגיל לתרגיל</Text>

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
                        placeholderTextColor="#8F8F96"
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
                        placeholderTextColor="#8F8F96"
                        textAlign="center"
                      />
                    </View>
                  </View>

                  <Pressable style={styles.startTimerButton} onPress={startRestTimer}>
                    <Text style={styles.startTimerButtonText}>הפעל טיימר מנוחה</Text>
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

                  <Pressable style={styles.backToTimerChoiceButton} onPress={() => setTimerMode('choice')}>
                    <Text style={styles.backToTimerChoiceButtonText}>חזרה לבחירת טיימר</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.timerDisplay}>{formatWorkoutTimer(workoutTimerElapsed)}</Text>
                  <Text style={styles.timerHint}>טיימר שסופר כמה זמן כל האימון לקח</Text>

                  <Pressable style={styles.startTimerButton} onPress={startWorkoutTimer}>
                    <Text style={styles.startTimerButtonText}>
                      {workoutTimerElapsed > 0 ? 'המשך ספירת זמן אימון' : 'התחל אימון'}
                    </Text>
                  </Pressable>

                  {workoutTimerElapsed > 0 && (
                    <View style={styles.timerActionsRow}>
                      <Pressable style={styles.secondaryTimerButton} onPress={pauseOrResumeWorkoutTimer}>
                        <Text style={styles.secondaryTimerButtonText}>{isWorkoutTimerRunning ? 'השהה' : 'המשך'}</Text>
                      </Pressable>

                      <Pressable style={styles.secondaryTimerButton} onPress={resetWorkoutTimer}>
                        <Text style={styles.secondaryTimerButtonText}>איפוס</Text>
                      </Pressable>
                    </View>
                  )}

                  <Pressable style={styles.backToTimerChoiceButton} onPress={() => setTimerMode('choice')}>
                    <Text style={styles.backToTimerChoiceButtonText}>חזרה לבחירת טיימר</Text>
                  </Pressable>
                </>
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
                  <CloseIcon size={24} color="#FFFFFF" />
                </Pressable>

                <Text style={styles.programModalTitle}>
                  {selectedProgramView === 'running'
                    ? 'תוכנית הריצה שלך'
                    : selectedProgramView === 'strength'
                      ? 'תוכנית הכוח שלך'
                      : 'בחירת תוכנית אימון'}
                </Text>
              </View>

              <View style={styles.modalDivider} />

              {selectedProgramView === 'strength' && isSplitStrengthProgram && (
                showStrengthDisplayControls ? (
                  <View style={styles.strengthDisplayModeTopBox}>
                    <View style={styles.strengthDisplayModeHeaderRow}>
                      <Pressable
                        style={styles.strengthDisplayModeCloseButton}
                        onPress={() => setShowStrengthDisplayControls(false)}
                        hitSlop={8}
                      >
                        <Text style={styles.strengthDisplayModeCloseButtonText}>×</Text>
                      </Pressable>

                      <Text style={styles.strengthDisplayModeTitle}>איך להציג את תוכנית הכוח?</Text>
                    </View>

                    <View style={styles.strengthDisplayModeButtonsRow}>
                      <Pressable
                        style={[
                          styles.strengthDisplayModeButton,
                          strengthDisplayMode === 'all' && styles.strengthDisplayModeButtonActive,
                        ]}
                        onPress={() => setStrengthDisplayMode('all')}
                      >
                        <Text
                          style={[
                            styles.strengthDisplayModeButtonText,
                            strengthDisplayMode === 'all' && styles.strengthDisplayModeButtonTextActive,
                          ]}
                        >
                          הצג את כל התוכנית
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.strengthDisplayModeButton,
                          strengthDisplayMode === 'ordered' && styles.strengthDisplayModeButtonActive,
                        ]}
                        onPress={() => setStrengthDisplayMode('ordered')}
                      >
                        <Text
                          style={[
                            styles.strengthDisplayModeButtonText,
                            strengthDisplayMode === 'ordered' && styles.strengthDisplayModeButtonTextActive,
                          ]}
                        >
                          הצג לפי ימים
                        </Text>
                      </Pressable>
                    </View>

                    {strengthDisplayMode === 'ordered' && (
                      <Text style={styles.strengthDisplayModeHint}>
                        כרגע מוצג יום {String(trainingSections[safeOrderedStrengthDayIndex]?.title || strengthDayLabels[safeOrderedStrengthDayIndex] || safeOrderedStrengthDayIndex + 1)}. בסיום היום לחץ על “סיימתי את היום” כדי לעבור ליום הבא.
                      </Text>
                    )}
                  </View>
                ) : (
                  <Pressable
                    style={styles.openStrengthDisplayControlsButton}
                    onPress={() => setShowStrengthDisplayControls(true)}
                  >
                    <Text style={styles.openStrengthDisplayControlsButtonText}>תצוגת אימון</Text>
                  </Pressable>
                )
              )}

              {!selectedProgramView && hasStrengthProgramContent && hasRunningProgramContent ? (
                <View style={styles.programChoiceBox}>
                  <Text style={styles.programChoiceTitle}>איזו תוכנית להציג?</Text>
                  <Pressable
                    style={styles.programChoiceButton}
                    onPress={() => setSelectedProgramView('strength')}
                  >
                    <Text style={styles.programChoiceButtonText}>אימון כוח</Text>
                  </Pressable>

                  <Pressable
                    style={styles.programChoiceButton}
                    onPress={() => setSelectedProgramView('running')}
                  >
                    <Text style={styles.programChoiceButtonText}>אימון ריצה</Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.programScrollContent}
                >
                  {selectedProgramView === 'running' ? (
                    isActiveRunningProgramCompleted ? (
                      <View style={styles.completedProgramBox}>
                        <Text style={styles.completedProgramTitle}>סיימת את כל תוכנית הריצה</Text>
                        <Text style={styles.completedProgramText}>כל הכבוד! לצפייה בכל השבועות והיסטוריית התוכניות המלאה יש להיכנס דרך התפריט לכפתור “תוכנית אימון”.</Text>
                      </View>
                    ) : visibleRunningWeeksOnHome.length > 0 ? (
                      visibleRunningWeeksOnHome.map((week, weekIndex) => {
                        const distanceKm = String(week?.distanceKm || '').trim();
                        const pacePerKm = String(week?.pacePerKm || '').trim();
                        const notes = String(week?.notes || '').trim();

                        if (!distanceKm && !pacePerKm && !notes && !week?.paceType && !week?.manipulationType) return null;

                        return (
                          <View key={week?.id || `running-week-${weekIndex}`} style={styles.programSectionCard}>
                            <Text style={styles.programSectionTitle}>שבוע {week?.weekNumber || weekIndex + 1}</Text>
                            <Text style={styles.activeWeekHint}>זה השבוע הפעיל שלך כרגע. אחרי שמירת הצלחה או אי הצלחה יוצג השבוע הבא.</Text>

                            <View style={styles.programMetaRow}>
                              {!!distanceKm && (
                                <View style={styles.programMetaChip}>
                                  <Text selectable={false} style={styles.programMetaChipText}>מרחק: {distanceKm} ק״מ</Text>
                                </View>
                              )}

                              {!!pacePerKm && (
                                <View style={styles.programMetaChip}>
                                  <Text selectable={false} style={styles.programMetaChipText}>זמן לק״מ: {pacePerKm}</Text>
                                </View>
                              )}

                              <View style={styles.programMetaChip}>
                                <Text selectable={false} style={styles.programMetaChipText}>צורת ריצה: {getPaceTypeLabel(week?.paceType)}</Text>
                              </View>

                              <View style={styles.programMetaChip}>
                                <Text selectable={false} style={styles.programMetaChipText}>מניפולציה: {getManipulationLabel(week?.manipulationType)}</Text>
                              </View>
                            </View>

                            {!!notes && <Text style={styles.programExerciseNotes}>{notes}</Text>}
                            <View style={styles.runningClientFeedbackBox}>
                              <Text style={styles.runningClientFeedbackTitle}>עדכון למאמן על השבוע</Text>
                              <View style={styles.clientWorkoutFeedbackRow}>
                                <Pressable style={[styles.clientWorkoutFeedbackButton, week.clientSucceeded === true && styles.clientWorkoutFeedbackSuccess]} onPress={() => updateLocalRunningWeek(week.id, { clientSucceeded: true })}>
                                  <Text style={[styles.clientWorkoutFeedbackText, week.clientSucceeded === true && styles.clientWorkoutFeedbackTextActive]}>הצלחתי</Text>
                                </Pressable>
                                <Pressable style={[styles.clientWorkoutFeedbackButton, week.clientSucceeded === false && styles.clientWorkoutFeedbackFail]} onPress={() => updateLocalRunningWeek(week.id, { clientSucceeded: false })}>
                                  <Text style={[styles.clientWorkoutFeedbackText, week.clientSucceeded === false && styles.clientWorkoutFeedbackTextActive]}>לא הצלחתי</Text>
                                </Pressable>
                              </View>
                              <TextInput style={[styles.inputBox, styles.textInput, styles.clientWorkoutNotesInput]} placeholder="פירוט למאמן" placeholderTextColor="#8F8F96" value={String(week.clientNotes || '')} onChangeText={(value) => updateLocalRunningWeek(week.id, { clientNotes: value })} textAlign="right" multiline />
                              <Pressable style={[styles.saveRunningFeedbackButton, savingRunningWeekId === week.id && styles.disabledButton]} onPress={() => saveRunningWeekFeedback(week.id)} disabled={savingRunningWeekId === week.id}>
                                {savingRunningWeekId === week.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveRunningFeedbackButtonText}>שמירת עדכון שבוע</Text>}
                              </Pressable>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyProgramText}>לא נמצאה תוכנית ריצה</Text>
                    )
                  ) : visibleStrengthSections.length > 0 ? (
                    <>
                      {visibleStrengthSections.map((section, visibleSectionIndex) => {
                      const sectionIndex = visibleStrengthStartIndex + visibleSectionIndex;
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

                            const exerciseKey = getProgramStrengthExerciseKey(sectionIndex, exerciseIndex, item);
                            const inlineEntry = getProgramStrengthEntry(exerciseKey, item);
                            const isSavingThisExercise = savingProgramStrengthExerciseKey === exerciseKey;
                            const isProgramExerciseOpen = !!expandedProgramExerciseKeys[exerciseKey];
                            const isProgramExerciseDone = !!inlineEntry.saved && !inlineEntry.isEditing;

                            return (
                              <View
                                key={exerciseKey}
                                style={[styles.programExerciseCard, isProgramExerciseDone && styles.programExerciseCardDone]}
                              >
                                <Pressable
                                  style={styles.programExerciseHeader}
                                  onPress={() => toggleProgramExerciseOpen(exerciseKey)}
                                  hitSlop={8}
                                >
                                  <View style={styles.programExerciseTitleBlock}>
                                    <Text style={styles.programExerciseChevron}>{isProgramExerciseOpen ? '⌃' : '⌄'}</Text>
                                    <Text style={styles.programExerciseName}>
                                      {exerciseName || 'ללא שם תרגיל'}
                                    </Text>
                                  </View>

                                  <View style={styles.programExerciseHeaderActions}>
                                    {isProgramExerciseDone && (
                                      <View style={styles.programExerciseDoneBadge}>
                                        <Text style={styles.programExerciseDoneBadgeText}>בוצע</Text>
                                      </View>
                                    )}

                                    {!!exerciseName && (
                                      <Pressable
                                        accessibilityLabel={`צפייה בביצוע האחרון של ${exerciseName}`}
                                        style={[
                                          styles.programLastExerciseButton,
                                          isLoadingLastExercise && loadingLastExerciseName === exerciseName && styles.disabledButton,
                                        ]}
                                        onPress={() => openLastExerciseModal(exerciseName)}
                                        disabled={isLoadingLastExercise}
                                        hitSlop={8}
                                      >
                                        {isLoadingLastExercise && loadingLastExerciseName === exerciseName ? (
                                          <ActivityIndicator color="#FFFFFF" size="small" />
                                        ) : (
                                          <DumbbellIcon size={20} color="#FFFFFF" />
                                        )}
                                      </Pressable>
                                    )}
                                  </View>
                                </Pressable>

                                {isProgramExerciseOpen && (
                                  <>
                                    {(sets || reps) && (
                                  <View style={styles.programMetaRow}>
                                    {!!sets && (
                                      <View style={styles.programMetaChip}>
                                        <Text selectable={false} style={styles.programMetaChipText}>סטים בתוכנית: {sets}</Text>
                                      </View>
                                    )}

                                    {!!reps && (
                                      <View style={styles.programMetaChip}>
                                        <Text selectable={false} style={styles.programMetaChipText}>חזרות בתוכנית: {reps}</Text>
                                      </View>
                                    )}
                                  </View>
                                )}

                                {!!notes && (
                                  <Text style={styles.programExerciseNotes}>{notes}</Text>
                                )}

                                    {!!exerciseName && (() => {
                                      const isEntryLocked = inlineEntry.saved && !inlineEntry.isEditing;
                                      return (
                                    <View style={styles.programInlineEntryBox}>
                                      <View style={styles.programInlineEntryHeaderRow}>
                                        <Text style={styles.programInlineEntryTitle}>הזנת ביצוע לתרגיל הזה</Text>
                                        {inlineEntry.saved && (
                                          <View style={styles.programInlineSavedBadge}>
                                            <Text style={styles.programInlineSavedBadgeText}>בוצע</Text>
                                          </View>
                                        )}
                                      </View>

                                      <View style={styles.programInlineSetsCountRow}>
                                        <Text style={styles.miniLabel}>סטים שבוצעו</Text>
                                        <TextInput
                                          style={[styles.inputBox, styles.textInput, styles.programInlineSetsCountInput]}
                                          keyboardType={INTEGER_KEYBOARD}
                                          inputMode="numeric"
                                          value={inlineEntry.setsCount}
                                          onChangeText={(value) => updateProgramStrengthSetsCount(exerciseKey, value, item)}
                                          placeholder={sets || '1'}
                                          placeholderTextColor="#8F8F96"
                                          textAlign="center"
                                          editable={!isSavingThisExercise && !isEntryLocked}
                                        />
                                      </View>

                                      <View style={styles.programInlineSetsList}>
                                        {inlineEntry.sets.map((setEntry, setIndex) => (
                                          <View key={`${exerciseKey}-set-${setIndex}`} style={styles.programInlineSetCard}>
                                            <Text style={styles.programInlineSetTitle}>סט {setIndex + 1}</Text>
                                            <View style={styles.programInlineInputsRow}>
                                              <View style={styles.programInlineInputCol}>
                                                <Text style={styles.miniLabel}>חזרות</Text>
                                                <TextInput
                                                  style={[styles.inputBox, styles.textInput, styles.programInlineInput]}
                                                  keyboardType={INTEGER_KEYBOARD}
                                                  inputMode="numeric"
                                                  value={setEntry.reps}
                                                  onChangeText={(value) => updateProgramStrengthSetField(exerciseKey, setIndex, 'reps', value, item)}
                                                  placeholder={reps || '0'}
                                                  placeholderTextColor="#8F8F96"
                                                  textAlign="center"
                                                  editable={!isSavingThisExercise && !isEntryLocked}
                                                />
                                              </View>

                                              <View style={styles.programInlineInputCol}>
                                                <Text style={styles.miniLabel}>משקל</Text>
                                                <TextInput
                                                  style={[styles.inputBox, styles.textInput, styles.programInlineInput]}
                                                  keyboardType={DECIMAL_KEYBOARD}
                                                  inputMode="decimal"
                                                  value={setEntry.weight}
                                                  onChangeText={(value) => updateProgramStrengthSetField(exerciseKey, setIndex, 'weight', value, item)}
                                                  placeholder="אופציונלי"
                                                  placeholderTextColor="#8F8F96"
                                                  textAlign="center"
                                                  editable={!isSavingThisExercise && !isEntryLocked}
                                                />
                                              </View>
                                            </View>
                                          </View>
                                        ))}
                                      </View>

                                      <View style={styles.clientWorkoutFeedbackRow}>
                                        <Pressable
                                          style={[styles.clientWorkoutFeedbackButton, inlineEntry.clientSucceeded === true && styles.clientWorkoutFeedbackSuccess]}
                                          onPress={() => updateProgramStrengthEntry(exerciseKey, { clientSucceeded: true, isEditing: true }, item)}
                                          disabled={isSavingThisExercise || isEntryLocked}
                                        >
                                          <Text style={[styles.clientWorkoutFeedbackText, inlineEntry.clientSucceeded === true && styles.clientWorkoutFeedbackTextActive]}>הצלחתי</Text>
                                        </Pressable>
                                        <Pressable
                                          style={[styles.clientWorkoutFeedbackButton, inlineEntry.clientSucceeded === false && styles.clientWorkoutFeedbackFail]}
                                          onPress={() => updateProgramStrengthEntry(exerciseKey, { clientSucceeded: false, isEditing: true }, item)}
                                          disabled={isSavingThisExercise || isEntryLocked}
                                        >
                                          <Text style={[styles.clientWorkoutFeedbackText, inlineEntry.clientSucceeded === false && styles.clientWorkoutFeedbackTextActive]}>לא הצלחתי</Text>
                                        </Pressable>
                                      </View>

                                      <View style={styles.programNotesIconRow}>
                                        <Pressable
                                          accessibilityLabel={inlineEntry.notesOpen ? 'סגירת פירוט למאמן' : 'פתיחת פירוט למאמן'}
                                          style={[
                                            styles.programNotesToggleButton,
                                            inlineEntry.notesOpen && styles.programNotesToggleButtonActive,
                                            !!inlineEntry.clientNotes.trim() && !inlineEntry.notesOpen && styles.programNotesToggleButtonHasText,
                                          ]}
                                          onPress={() =>
                                            updateProgramStrengthEntry(
                                              exerciseKey,
                                              { notesOpen: !inlineEntry.notesOpen },
                                              item
                                            )
                                          }
                                          disabled={isSavingThisExercise}
                                        >
                                          <WriteIcon
                                            size={18}
                                            color={inlineEntry.notesOpen ? '#FFFFFF' : inlineEntry.clientNotes.trim() ? '#1D4ED8' : '#0C4A6E'}
                                          />
                                        </Pressable>
                                      </View>

                                      {inlineEntry.notesOpen && (
                                        <TextInput
                                          style={[styles.inputBox, styles.textInput, styles.clientWorkoutNotesInput]}
                                          placeholder="פירוט למאמן על התרגיל"
                                          placeholderTextColor="#8F8F96"
                                          value={inlineEntry.clientNotes}
                                          onChangeText={(value) =>
                                            updateProgramStrengthEntry(
                                              exerciseKey,
                                              { clientNotes: value, isEditing: true, notesOpen: true },
                                              item
                                            )
                                          }
                                          textAlign="right"
                                          multiline
                                          editable={!isSavingThisExercise && !isEntryLocked}
                                        />
                                      )}

                                      {isEntryLocked ? (
                                        <Pressable
                                          style={styles.editProgramExerciseButton}
                                          onPress={() => enableProgramStrengthExerciseEdit(exerciseKey, item)}
                                          disabled={isSavingThisExercise}
                                        >
                                          <Text style={styles.editProgramExerciseButtonText}>עריכת ביצוע</Text>
                                        </Pressable>
                                      ) : (
                                        <Pressable
                                          style={[styles.saveProgramExerciseButton, isSavingThisExercise && styles.disabledButton]}
                                          onPress={() => saveProgramStrengthExercise(exerciseKey, item, sectionTitle, sectionIndex)}
                                          disabled={isSavingThisExercise}
                                        >
                                          {isSavingThisExercise ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                          ) : (
                                            <Text style={styles.saveProgramExerciseButtonText}>{inlineEntry.saved ? 'שמירת עריכה' : 'שמירת ביצוע התרגיל'}</Text>
                                          )}
                                        </Pressable>
                                      )}
                                    </View>
                                  );
                                    })()}
                                  </>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}

                      {isSplitStrengthProgram && strengthDisplayMode === 'ordered' && (
                        <Pressable style={styles.advanceStrengthDayButton} onPress={advanceOrderedStrengthDay}>
                          <Text style={styles.advanceStrengthDayButtonText}>סיימתי את היום - עבור ליום הבא</Text>
                        </Pressable>
                      )}
                    </>
                  ) : (
                    <Text style={styles.emptyProgramText}>לא נמצאה תוכנית כוח</Text>
                  )}

                  {selectedProgramView === 'strength' && !!strengthGeneralNotes && (
                    <View style={styles.generalNotesCard}>
                      <Text style={styles.generalNotesTitle}>הערות כלליות לכוח</Text>
                      <Text style={styles.generalNotesText}>{strengthGeneralNotes}</Text>
                    </View>
                  )}

                  {selectedProgramView === 'running' && !isActiveRunningProgramCompleted && !!runningGeneralNotes && (
                    <View style={styles.generalNotesCard}>
                      <Text style={styles.generalNotesTitle}>הערות כלליות לריצה</Text>
                      <Text style={styles.generalNotesText}>{runningGeneralNotes}</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
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
                <CloseIcon size={24} color="#FFFFFF" />
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
    backgroundColor: '#17171C',
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
    color: '#FFFFFF',
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
    color: '#B3B3B3',
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
    backgroundColor: '#2A1A10',
    borderWidth: 1,
    borderColor: '#FF7A00',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    paddingHorizontal: 14,
  },

  trainingProgramButtonText: {
    color: '#FF9A3D',
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  section: {
    width: '100%',
    marginBottom: 18,
  },

  label: {
    color: '#EDEDED',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
    writingDirection: 'rtl',
  },

  inputBox: {
    width: '100%',
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },

  textInput: {
    color: '#FFFFFF',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  exerciseNameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingRight: 2,
    paddingLeft: 2,
    overflow: 'hidden',
    position: 'relative',
    minWidth: 0,
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
    minWidth: 0,
    width: '100%',
    minHeight: '100%',
    paddingVertical: 0,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    borderWidth: 0,
    textAlign: 'right',
    textAlignVertical: 'center',
    writingDirection: 'rtl',
    includeFontPadding: true,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          outlineWidth: 0,
          outlineStyle: 'none',
          direction: 'rtl',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
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
    backgroundColor: '#222229',
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
    color: '#B3B3B3',
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
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
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
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'right',
  },

  dateHint: {
    marginTop: 2,
    color: '#B3B3B3',
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
    minWidth: 0,
  },

  fullWidthOnSmall: {
    width: '100%',
  },

  iconButton: {
    width: 58,
    borderRadius: 16,
    backgroundColor: '#FF7A00',
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
    borderColor: '#2B2B31',
    backgroundColor: '#17171C',
    overflow: 'hidden',
  },

  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  suggestionText: {
    color: '#FFFFFF',
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
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
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
  },

  setTitle: {
    color: '#FFFFFF',
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
    color: '#B3B3B3',
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
    backgroundColor: '#FF7A00',
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
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  dateModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#17171C',
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
  },

  dateModalTitle: {
    color: '#FFFFFF',
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
    backgroundColor: '#FF7A00',
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
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },

  modalCard: {
    backgroundColor: '#17171C',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#2B2B31',
    padding: 20,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },

  modalClose: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF7A00',
    borderWidth: 1,
    borderColor: '#FF9A3D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 4,
  },

  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#2B2B31',
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
    color: '#EDEDED',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  programModalCard: {
    maxHeight: '88%',
    backgroundColor: '#17171C',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#2B2B31',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.48,
    shadowRadius: 24,
    elevation: 12,
  },

  programHeaderRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  programChoiceBox: {
    width: '100%',
    gap: 12,
    paddingVertical: 6,
  },

  programChoiceTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 4,
  },

  programChoiceButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#2A1A10',
    borderWidth: 1,
    borderColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  programChoiceButtonText: {
    color: '#FF9A3D',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  programModalTitle: {
    flex: 1,
    color: '#FFFFFF',
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
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },

  programSectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 10,
  },

  programExerciseCard: {
    width: '100%',
    backgroundColor: '#17171C',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },

  programExerciseCardDone: {
    borderColor: '#22C55E',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },

  programExerciseHeader: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },

  programExerciseTitleBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },

  programExerciseChevron: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },

  programExerciseHeaderActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },

  programExerciseDoneBadge: {
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#22C55E',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  programExerciseDoneBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  programExerciseName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  programLastExerciseButton: {
    width: 42,
    height: 42,
    minWidth: 42,
    borderRadius: 14,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
  },





  programMetaRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  programMetaChip: {
    backgroundColor: '#2B2B31',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  programMetaChipText: {
    color: '#EDEDED',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  programExerciseNotes: {
    color: '#B3B3B3',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },


  programInlineEntryBox: {
    width: '100%',
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },

  programInlineEntryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  programInlineEntryHeaderRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  programInlineSavedBadge: {
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  programInlineSavedBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  programInlineSetsCountRow: {
    width: '100%',
    gap: 6,
  },

  programInlineSetsCountInput: {
    minHeight: 46,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  programInlineSetsList: {
    width: '100%',
    gap: 8,
  },

  programInlineSetCard: {
    width: '100%',
    backgroundColor: '#17171C',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },

  programInlineSetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  programInlineInputsRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 8,
  },

  programInlineInputCol: {
    flex: 1,
  },

  programInlineInput: {
    minHeight: 46,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  saveProgramExerciseButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveProgramExerciseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  editProgramExerciseButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#2A1A10',
    borderWidth: 1,
    borderColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editProgramExerciseButtonText: {
    color: '#FF9A3D',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  completedProgramBox: {
    width: '100%',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  completedProgramTitle: {
    color: '#166534',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  completedProgramText: {
    color: '#14532D',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  activeWeekHint: { color: '#B3B3B3', fontSize: 13, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl', marginBottom: 8 },

  emptyProgramText: {
    color: '#B3B3B3',
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
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeTimersWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },

  activeTimerChip: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#2A1A10',
    borderWidth: 1,
    borderColor: '#FF7A00',
  },

  activeTimerText: {
    color: '#FF9A3D',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  sideMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },

  sideMenuCard: {
    height: '100%',
    backgroundColor: '#17171C',
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
    backgroundColor: '#FF7A00',
    borderWidth: 1,
    borderColor: '#FF9A3D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sideMenuTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  trainingProgramMenuButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#2A1A10',
    borderWidth: 1,
    borderColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },

  trainingProgramMenuButtonText: {
    color: '#FF9A3D',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  sideMenuLoaderBox: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 6,
  },

  sideMenuLoaderText: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  timerMenuButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FF7A00',
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

  timerChoiceBox: {
    width: '100%',
    gap: 12,
    marginTop: 14,
  },

  timerChoiceButton: {
    width: '100%',
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: '#FF7A00',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  timerChoiceSecondaryButton: {
    width: '100%',
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  timerChoiceTextBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },

  timerChoiceButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  timerChoiceButtonSubText: {
    marginTop: 2,
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  timerChoiceSecondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  timerChoiceSecondaryButtonSubText: {
    marginTop: 2,
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  backToTimerChoiceButton: {
    width: '100%',
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  backToTimerChoiceButtonText: {
    color: '#EDEDED',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  timerModalCard: {
    backgroundColor: '#17171C',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#2B2B31',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.48,
    shadowRadius: 24,
    elevation: 12,
  },

  timerModalHeader: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  timerModalTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  timerDisplay: {
    marginTop: 18,
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
  },

  timerHint: {
    marginTop: 6,
    marginBottom: 18,
    color: '#B3B3B3',
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
    backgroundColor: '#FF7A00',
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
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryTimerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  programNotesIconRow: {
    width: '100%',
    alignItems: 'flex-end',
  },

  programNotesToggleButton: {
    width: 38,
    height: 38,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#2A1A10',
    borderWidth: 1,
    borderColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  programNotesToggleButtonActive: {
    backgroundColor: '#FF7A00',
    borderColor: '#0C4A6E',
  },

  programNotesToggleButtonHasText: {
    backgroundColor: '#2A1A10',
    borderColor: '#FF7A00',
  },

  strengthDisplayModeTopBox: {
    width: '100%',
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },

  strengthDisplayModeHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  strengthDisplayModeCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2B2B31',
    alignItems: 'center',
    justifyContent: 'center',
  },

  strengthDisplayModeCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
    textAlign: 'center',
  },

  openStrengthDisplayControlsButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#2A1A10',
    borderWidth: 1,
    borderColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 14,
  },

  openStrengthDisplayControlsButtonText: {
    color: '#FF9A3D',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  strengthDisplayModeBox: {
    width: '100%',
    backgroundColor: '#222229',
    borderWidth: 1,
    borderColor: '#2B2B31',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },

  strengthDisplayModeTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  strengthDisplayModeButtonsRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 8,
  },

  strengthDisplayModeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2B2B31',
    backgroundColor: '#17171C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  strengthDisplayModeButtonActive: {
    backgroundColor: '#FF7A00',
    borderColor: '#0F172A',
  },

  strengthDisplayModeButtonText: {
    color: '#EDEDED',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  strengthDisplayModeButtonTextActive: {
    color: '#FFFFFF',
  },

  strengthDisplayModeHint: {
    color: '#B3B3B3',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  advanceStrengthDayButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 14,
  },

  advanceStrengthDayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  clientWorkoutFeedbackBox: { width: '100%', backgroundColor: '#222229', borderWidth: 1, borderColor: '#2B2B31', borderRadius: 18, padding: 12, marginBottom: 14, gap: 10 },
  clientWorkoutFeedbackRow: { width: '100%', flexDirection: 'row-reverse', gap: 8 },
  clientWorkoutFeedbackButton: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: '#2B2B31', backgroundColor: '#17171C', alignItems: 'center', justifyContent: 'center' },
  clientWorkoutFeedbackSuccess: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  clientWorkoutFeedbackFail: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  clientWorkoutFeedbackText: { color: '#EDEDED', fontSize: 13, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' },
  clientWorkoutFeedbackTextActive: { color: '#FFFFFF' },
  clientWorkoutNotesInput: { minHeight: 86, paddingVertical: 12, textAlignVertical: 'top' },
  runningClientFeedbackBox: { backgroundColor: '#17171C', borderRadius: 16, borderWidth: 1, borderColor: '#2B2B31', padding: 12, marginTop: 10, gap: 9 },
  runningClientFeedbackTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  saveRunningFeedbackButton: { minHeight: 44, borderRadius: 14, backgroundColor: '#FF7A00', alignItems: 'center', justifyContent: 'center' },
  saveRunningFeedbackButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  coachFeedbackCard: { backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', padding: 10, marginTop: 8 },
  coachFeedbackTitle: { color: '#92400E', fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginBottom: 4 },
  coachFeedbackText: { color: '#78350F', fontSize: 13, lineHeight: 20, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },

});