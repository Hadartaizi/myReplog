import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  Dimensions,
  View,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
  useWindowDimensions,
  SafeAreaView,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { useFonts } from 'expo-font';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import AppLayout from './components/AppLayout';
import { auth, db } from '../database/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { LineChart, BarChart } from 'react-native-chart-kit';
import ModalSelector from 'react-native-modal-selector';

const { height: screenHeight } = Dimensions.get('window');
const APP_BG = '#F4F7FB';

const timeOptions = {
  'כל הזמנים (יומי)': 'all',
  'דו שבועי': 14,
  'חודשי': 30,
  'רבעוני': 90,
  'חצי שנתי': 182,
  'שנתי': 365,
};

const normalizeText = (text: string) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^֐-׿\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

type WorkoutLike = {
  id?: string;
  uid?: string;
  exerciseName?: string;
  title?: string;
  name?: string;
  date?: any;
  numSets?: number;
  repsPerSet?: Record<string, { reps?: string; weight?: string }>;
  createdAt?: any;
  updatedAt?: any;
};

function ArrowDownIcon({ size = 20, color = '#5B6470' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DeleteIcon({ size = 18, color = '#DC2626' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth={2} />
      <Rect x="6" y="7" width="12" height="13" stroke={color} strokeWidth={2} fill="none" rx="1.5" />
      <Line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth={2} />
      <Line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth={2} />
      <Line x1="9" y1="5" x2="15" y2="5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ChartIcon({ size = 26, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="4" y1="20" x2="20" y2="20" stroke={color} strokeWidth={2} />
      <Rect x="6" y="12" width="2.5" height="8" fill={color} rx="1" />
      <Rect x="10.75" y="8" width="2.5" height="12" fill={color} rx="1" />
      <Rect x="15.5" y="5" width="2.5" height="15" fill={color} rx="1" />
    </Svg>
  );
}

function ExpandIcon({ size = 18, color = '#0F172A' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 21h-5v-5"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export default function GraphScreen() {
  const { width, height } = useWindowDimensions();

  const isVerySmall = width < 340;
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  const dynamic = useMemo(() => {
    const horizontalPadding = isTablet ? width * 0.04 : width * 0.05;
    const cardWidth = Math.min(width * 0.94, 640);
    const inputHeight = isVerySmall ? 44 : isSmallScreen ? 48 : 52;
    const titleSize = isVerySmall ? 21 : isSmallScreen ? 23 : isTablet ? 30 : 27;
    const labelSize = isVerySmall ? 13 : 15;
    const textSize = isVerySmall ? 13 : isSmallScreen ? 14 : 16;
    const cardPaddingHorizontal = isVerySmall ? 14 : isSmallScreen ? 18 : isTablet ? 28 : 22;
    const cardPaddingVertical = isVerySmall ? 18 : isTablet ? 28 : 24;
    const graphHeight = isVerySmall ? 220 : isTablet ? 290 : 250;
    const selectorFont = isVerySmall ? 15 : 16;

    return {
      horizontalPadding,
      cardWidth,
      inputHeight,
      titleSize,
      labelSize,
      textSize,
      cardPaddingHorizontal,
      cardPaddingVertical,
      graphHeight,
      selectorFont,
    };
  }, [width, isVerySmall, isSmallScreen, isTablet]);

  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exerciseSearchText, setExerciseSearchText] = useState('');
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [dataType, setDataType] = useState('');
  const [chartType, setChartType] = useState('');
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [deletedExerciseNames, setDeletedExerciseNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFullScreenChartVisible, setIsFullScreenChartVisible] = useState(false);
  const [chartData, setChartData] = useState<{ labels: string[]; datasets: { data: number[] }[] }>({
    labels: [],
    datasets: [{ data: [] }],
  });

  const scrollRef = useRef<ScrollView | null>(null);
  const fullScreenScrollRef = useRef<ScrollView | null>(null);

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: '#F8FAFC',
      backgroundGradientTo: '#F8FAFC',
      decimalPlaces: 1,
      color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
      labelColor: () => '#334155',
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#E2E8F0',
      },
      propsForDots: {
        r: isVerySmall ? '3.5' : '4',
        strokeWidth: '2',
        stroke: '#0F172A',
      },
      strokeWidth: 2,
      barPercentage: isVerySmall ? 0.58 : 0.7,
      fillShadowGradient: '#0F172A',
      fillShadowGradientOpacity: 0.18,
      propsForLabels: {
        fontSize: isVerySmall ? 10 : 12,
      },
    }),
    [isVerySmall]
  );

  const chartConfigFullScreen = useMemo(
    () => ({
      backgroundGradientFrom: '#FFFFFF',
      backgroundGradientTo: '#FFFFFF',
      decimalPlaces: 1,
      color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
      labelColor: () => '#1E293B',
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#E2E8F0',
      },
      propsForDots: {
        r: '3.2',
        strokeWidth: '2',
        stroke: '#0F172A',
      },
      strokeWidth: 2,
      barPercentage: 0.34,
      fillShadowGradient: '#0F172A',
      fillShadowGradientOpacity: 0.14,
      propsForLabels: {
        fontSize: 9,
      },
    }),
    []
  );

  const textAlignByLanguage = (text: string) => (/[a-zA-Z]/.test(text) ? 'left' : 'right');

  const parseWorkoutDate = (dateValue: any) => {
    if (!dateValue) return null;
    if (dateValue?.toDate) return dateValue.toDate();
    if (dateValue instanceof Date) return dateValue;

    if (typeof dateValue === 'string') {
      const simpleDateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (simpleDateMatch) {
        const [, year, month, day] = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)!;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }

      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    return null;
  };

  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getFormattedDateLabel = (date: Date) =>
    date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });

  const getFormattedDateLabelShort = (date: Date) =>
    date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });

  const getExerciseNameFromDoc = (item: any) =>
    String(item?.exerciseName || item?.title || item?.name || '').trim();

  const resetChartSelections = () => {
    setDataType('');
    setChartType('');
    setChartData({ labels: [], datasets: [{ data: [] }] });
    setIsFullScreenChartVisible(false);
  };

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
      console.error('Error fetching deleted exercises:', error);
      const emptySet = new Set<string>();
      setDeletedExerciseNames(emptySet);
      return emptySet;
    }
  }, []);

  const fetchExercises = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setAvailableExercises([]);
      setDeletedExerciseNames(new Set());
      return;
    }

    try {
      const deletedSet = await loadDeletedExercises(user.uid);

      const workoutsQuery = query(collection(db, 'workouts'), where('uid', '==', user.uid));
      const workoutsSnapshot = await getDocs(workoutsQuery);

      const namesFromWorkouts = workoutsSnapshot.docs
        .map((docItem) => getExerciseNameFromDoc(docItem.data()))
        .filter(Boolean);

      const exercisesQuery = query(collection(db, 'exercises'), where('uid', '==', user.uid));
      const exercisesSnapshot = await getDocs(exercisesQuery);

      const namesFromExercises = exercisesSnapshot.docs
        .map((docItem) => getExerciseNameFromDoc(docItem.data()))
        .filter(Boolean);

      const merged = [...namesFromWorkouts, ...namesFromExercises];
      const uniqueVisibleNames: string[] = [];
      const seen = new Set<string>();

      for (const rawName of merged) {
        const normalized = normalizeText(rawName);
        if (!normalized || deletedSet.has(normalized) || seen.has(normalized)) continue;
        seen.add(normalized);
        uniqueVisibleNames.push(rawName);
      }

      setAvailableExercises(uniqueVisibleNames.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error('Error fetching exercises:', error);
      setAvailableExercises([]);
    }
  }, [loadDeletedExercises]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    const fetchWorkoutData = async () => {
      setLoading(true);

      const user = auth.currentUser;
      if (!user || !selectedExercise || !selectedPeriod || !dataType) {
        setChartData({ labels: [], datasets: [{ data: [] }] });
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'workouts'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);

        const selectedNormalized = normalizeText(selectedExercise);

        let filteredWorkouts = snapshot.docs
          .map((docItem) => docItem.data())
          .filter((workout: any) => {
            const normalizedName = normalizeText(getExerciseNameFromDoc(workout));
            if (!normalizedName) return false;
            if (deletedExerciseNames.has(normalizedName)) return false;
            return normalizedName === selectedNormalized;
          });

        filteredWorkouts = filteredWorkouts
          .filter((workout: any) => !!parseWorkoutDate(workout.date))
          .sort((a: any, b: any) => {
            const dateA = parseWorkoutDate(a.date);
            const dateB = parseWorkoutDate(b.date);
            return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          });

        generateChartData(filteredWorkouts);
      } catch (error) {
        console.error('Error fetching workout data:', error);
        setChartData({ labels: [], datasets: [{ data: [] }] });
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutData();
  }, [selectedPeriod, selectedExercise, dataType, deletedExerciseNames]);

  const generateChartData = (filteredWorkouts: WorkoutLike[]) => {
    if (!filteredWorkouts.length) {
      setChartData({ labels: [], datasets: [{ data: [] }] });
      return;
    }

    const groupedMap: Record<
      string,
      { label: string; sortValue: number; values: number[] }
    > = {};

    const dayMs = 24 * 60 * 60 * 1000;

    const validDates = filteredWorkouts
      .map((workout) => parseWorkoutDate(workout.date))
      .filter((date): date is Date => !!date)
      .map((date) => startOfDay(date))
      .sort((a, b) => a.getTime() - b.getTime());

    if (!validDates.length) {
      setChartData({ labels: [], datasets: [{ data: [] }] });
      return;
    }

    const anchorDate = validDates[0];

    const addDays = (baseDate: Date, daysToAdd: number) => {
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      nextDate.setHours(0, 0, 0, 0);
      return nextDate;
    };

    const getBucketStartLabel = (date: Date, includeYear: boolean) =>
      date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        ...(includeYear ? { year: '2-digit' } : {}),
      });

    const getRelativeBucketData = (date: Date, bucketDays: number, bucketPrefix: string) => {
      const normalizedDate = startOfDay(date);
      const diffDays = Math.floor(
        (normalizedDate.getTime() - anchorDate.getTime()) / dayMs
      );
      const bucketIndex = Math.max(0, Math.floor(diffDays / bucketDays));
      const bucketStart = addDays(anchorDate, bucketIndex * bucketDays);

      return {
        key: `${bucketPrefix}-${bucketIndex}`,
        label: getBucketStartLabel(bucketStart, true),

        sortValue: bucketStart.getTime(),
      };
    };

    const getBucketData = (date: Date) => {
      const d = startOfDay(date);

      switch (selectedPeriod) {
        case 'כל הזמנים (יומי)':
          return {
            key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
            label: getFormattedDateLabel(d),

            sortValue: d.getTime(),
          };

        case 'דו שבועי':
          return getRelativeBucketData(d, 14, 'biweekly');

        case 'חודשי':
          return getRelativeBucketData(d, 30, 'monthly');

        case 'רבעוני':
          return getRelativeBucketData(d, 90, 'quarterly');

        case 'חצי שנתי':
          return getRelativeBucketData(d, 182, 'halfyear');

        case 'שנתי':
          return getRelativeBucketData(d, 365, 'yearly');

        default:
          return {
            key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
            label: getFormattedDateLabel(d),

            sortValue: d.getTime(),
          };
      }
    };

    filteredWorkouts.forEach((w: any) => {
      const workoutDate = parseWorkoutDate(w.date);
      if (!workoutDate) return;

      const bucket = getBucketData(workoutDate);
      const sets = Object.values(w.repsPerSet || {}) as { reps?: string; weight?: string }[];
      if (sets.length === 0) return;

      let value = 0;

      if (dataType === 'חזרות') {
        const totalReps = sets.reduce((sum, s) => sum + (parseInt(s.reps || '0', 10) || 0), 0);
        value = totalReps / sets.length;
      } else if (dataType === 'סטים') {
        value = parseInt(String(w.numSets || '0'), 10) || 0;
      } else if (dataType === 'משקל') {
        const totalWeight = sets.reduce((sum, s) => sum + (parseFloat(s.weight || '0') || 0), 0);
        value = totalWeight / sets.length;
      } else if (dataType === 'נפח אימון') {
        value = sets.reduce((sum, s) => {
          const reps = parseFloat(s.reps || '0') || 0;
          const weight = parseFloat(s.weight || '0') || 0;
          return sum + weight * reps;
        }, 0);
      }

      if (!groupedMap[bucket.key]) {
        groupedMap[bucket.key] = {
          label: bucket.label,
          sortValue: bucket.sortValue,
          values: [],
        };
      }

      groupedMap[bucket.key].values.push(value);
    });

    const sortedBuckets = Object.values(groupedMap).sort((a, b) => a.sortValue - b.sortValue);

    const averagedValues = sortedBuckets.map((item) => {
      const values = item.values;
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    let finalValues = averagedValues;

    if (dataType === 'נפח אימון') {
      const validVolumeValues = averagedValues.filter((value) => value > 0);

      if (validVolumeValues.length > 0) {
        const minVolume = Math.min(...validVolumeValues);
        const maxVolume = Math.max(...validVolumeValues);

        finalValues = averagedValues.map((value) => {
          if (value <= 0) return 0;
          if (maxVolume === minVolume) return 5;

          const normalized = 1 + ((value - minVolume) / (maxVolume - minVolume)) * 9;
          return parseFloat(normalized.toFixed(1));
        });
      }
    }

    setChartData({
      labels: sortedBuckets.map((item) => item.label),
      datasets: [
        {
          data: finalValues,
        },
      ],
    });
  };

  const deleteExerciseConfirmed = async (exerciseName: string) => {
    try {
      const user = auth.currentUser;
      if (!user || isDeleting) return;

      setIsDeleting(true);

      const normalizedTarget = normalizeText(exerciseName);
      const deletedDocRef = doc(db, 'users', user.uid, 'deletedExercises', normalizedTarget);

      await setDoc(
        deletedDocRef,
        {
          exerciseName: exerciseName.trim(),
          normalizedName: normalizedTarget,
          uid: user.uid,
          deletedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const workoutsQuery = query(collection(db, 'workouts'), where('uid', '==', user.uid));
      const workoutsSnapshot = await getDocs(workoutsQuery);

      await Promise.all(
        workoutsSnapshot.docs
          .filter((docSnap) => normalizeText(getExerciseNameFromDoc(docSnap.data())) === normalizedTarget)
          .map((docSnap) => deleteDoc(doc(db, 'workouts', docSnap.id)))
      );

      const exercisesQuery = query(collection(db, 'exercises'), where('uid', '==', user.uid));
      const exercisesSnapshot = await getDocs(exercisesQuery);

      await Promise.all(
        exercisesSnapshot.docs
          .filter((docSnap) => normalizeText(getExerciseNameFromDoc(docSnap.data())) === normalizedTarget)
          .map((docSnap) => deleteDoc(doc(db, 'exercises', docSnap.id)))
      );

      await fetchExercises();
      setSelectedExercise('');
      setExerciseSearchText('');
      resetChartSelections();

      if (Platform.OS === 'web') {
        window.alert('התרגיל נמחק בהצלחה');
      } else {
        Alert.alert('הצלחה', 'התרגיל נמחק בהצלחה');
      }
    } catch (error) {
      console.error('Error deleting exercise:', error);

      if (Platform.OS === 'web') {
        window.alert('לא הצלחתי למחוק את התרגיל');
      } else {
        Alert.alert('שגיאה', 'לא הצלחתי למחוק את התרגיל.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteExercise = async (exerciseName: string) => {
    if (!exerciseName || isDeleting) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `למחוק את התרגיל "${exerciseName}"?\nהמחיקה תסיר גם את כל ההיסטוריה שלו.`
      );

      if (!confirmed) return;
      await deleteExerciseConfirmed(exerciseName);
      return;
    }

    Alert.alert(
      'אישור מחיקה',
      `למחוק את התרגיל "${exerciseName}"?\nהמחיקה תסיר גם את כל ההיסטוריה שלו.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחקי לצמיתות',
          style: 'destructive',
          onPress: () => {
            deleteExerciseConfirmed(exerciseName);
          },
        },
      ]
    );
  };

  const filteredExercises = useMemo(() => {
    const normalizedSearch = normalizeText(exerciseSearchText);

    if (!normalizedSearch) return availableExercises;

    return availableExercises.filter((exerciseName) =>
      normalizeText(exerciseName).includes(normalizedSearch)
    );
  }, [availableExercises, exerciseSearchText]);

  const openExerciseModal = () => {
    setExerciseSearchText(selectedExercise || '');
    setExerciseModalVisible(true);
  };

  const closeExerciseModal = () => {
    setExerciseModalVisible(false);
    setExerciseSearchText(selectedExercise || '');
  };

  const chooseExercise = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setExerciseSearchText(exerciseName);
    resetChartSelections();
    setExerciseModalVisible(false);
  };

  const openFullScreenChart = () => {
    if (!chartData.labels.length) return;
    setIsFullScreenChartVisible(true);
  };

  const closeFullScreenChart = () => {
    setIsFullScreenChartVisible(false);
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const metricText =
    dataType === 'חזרות'
      ? 'ממוצע חזרות'
      : dataType === 'סטים'
      ? 'כמות סטים'
      : dataType === 'משקל'
      ? 'ממוצע משקל'
      : 'עוצמת נפח';

  const yAxisText =
    dataType === 'חזרות'
      ? 'ממוצע חזרות'
      : dataType === 'סטים'
      ? 'מספר סטים'
      : dataType === 'משקל'
      ? 'משקל (ק"ג)'
      : 'עוצמת נפח (1–10)';

  const regularLabels = chartData.labels;
  const regularChartData = {
    labels: regularLabels,
    datasets: chartData.datasets,
  };

  const fullScreenChartData = {
    labels: regularLabels,
    datasets: chartData.datasets,
  };

  const chartViewportWidth = Math.max(dynamic.cardWidth - (isVerySmall ? 20 : 28), 260);

  const regularUnitWidth =
    chartType === 'עמודות'
      ? isVerySmall
        ? 58
        : 68
      : isVerySmall
      ? 74
      : 86;

  const chartWidth = Math.max(chartViewportWidth, regularChartData.labels.length * regularUnitWidth);

  const fakeLandscapeChartWidth = Math.max(height - 30, 320);
  const fakeLandscapeChartHeight = Math.max(width - 80, 220);

  const compactUnitWidth =
    chartType === 'עמודות'
      ? Math.max(14, Math.min(22, Math.floor(fakeLandscapeChartWidth / 14)))
      : Math.max(18, Math.min(28, Math.floor(fakeLandscapeChartWidth / 12)));

  const fullScreenChartWidth = Math.max(
    fakeLandscapeChartWidth,
    fullScreenChartData.labels.length * compactUnitWidth
  );

  const fullScreenChartHeight = fakeLandscapeChartHeight;

  const renderRegularChart = () => {
    const commonProps = {
      data: regularChartData,
      width: chartWidth,
      height: dynamic.graphHeight,
      fromZero: true,
      yAxisLabel: '',
      yAxisSuffix: dataType === 'משקל' ? ' ק"ג' : '',
      chartConfig,
      verticalLabelRotation: isVerySmall ? 15 : 0,
      style: styles.chart,
      withInnerLines: true,
      withOuterLines: false,
      segments: 5,
    };

    return chartType === 'קווי'
      ? <LineChart {...commonProps} bezier />
      : <BarChart {...commonProps} />;
  };

  const renderFullScreenChart = () => {
    const commonProps = {
      data: fullScreenChartData,
      width: fullScreenChartWidth,
      height: fullScreenChartHeight,
      fromZero: true,
      yAxisLabel: '',
      yAxisSuffix: dataType === 'משקל' ? ' ק"ג' : '',
      chartConfig: chartConfigFullScreen,
      verticalLabelRotation: 0,
      style: styles.fullScreenChart,
      withInnerLines: true,
      withOuterLines: false,
      segments: 5,
    };

    return chartType === 'קווי'
      ? <LineChart {...commonProps} bezier />
      : <BarChart {...commonProps} />;
  };

  const selectorBoxStyle = {
    width: Math.min(width * 0.9, 420),
    maxHeight: screenHeight * 0.6,
    alignSelf: 'center' as const,
    borderRadius: 16,
  };

  const selectorRow = ({
    value,
    placeholder,
    fontSize,
  }: {
    value: string;
    placeholder: string;
    fontSize: number;
  }) => (
    <View style={styles.selectorInnerRow}>
      <ArrowDownIcon size={22} color="#5B6470" />
      <Text
        style={[value ? styles.selectorText : styles.selectorPlaceholderText, { fontSize }]}
        numberOfLines={1}
      >
        {value || placeholder}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <AppLayout>
          <View style={styles.screen}>
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
              scrollEnabled={!isFullScreenChartVisible}
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
                  <Text
                    style={[
                      styles.title,
                      {
                        fontSize: dynamic.titleSize,
                        lineHeight: dynamic.titleSize * 1.45,
                      },
                    ]}
                  >
                    מסך גרפים
                  </Text>

                  <Text style={[styles.subtitle, { fontSize: dynamic.textSize - 1 }]}>
                    צפייה במגמות התקדמות לפי תרגיל, תקופה ונתוני אימון
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>תקופה</Text>
                  <ModalSelector
                    data={Object.keys(timeOptions).map((label, index) => ({
                      key: index,
                      label,
                      value: label,
                    }))}
                    onChange={(option) => {
                      setSelectedPeriod(option.value);
                    }}
                    cancelText="ביטול"
                    optionContainerStyle={selectorBoxStyle}
                    optionTextStyle={(text: string) => ({
                      fontSize: dynamic.selectorFont,
                      textAlign: textAlignByLanguage(text),
                    })}
                    overlayStyle={styles.modalOverlay}
                    cancelStyle={styles.modalCancelButton}
                    cancelTextStyle={styles.modalCancelText}
                  >
                    <View style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}>
                      {selectorRow({
                        value: selectedPeriod,
                        placeholder: 'בחרי תקופה',
                        fontSize: dynamic.textSize,
                      })}
                    </View>
                  </ModalSelector>
                </View>

                {selectedPeriod !== '' && (
                  <View style={styles.section}>
                    <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>חפש/י תרגיל</Text>

                    <Pressable
                      onPress={openExerciseModal}
                      style={({ pressed }) => [
                        styles.singleExerciseBox,
                        { minHeight: dynamic.inputHeight },
                        pressed && styles.singleExerciseBoxPressed,
                      ]}
                    >
                      <ArrowDownIcon size={22} color="#5B6470" />
                      <Text
                        style={[
                          selectedExercise ? styles.singleExerciseText : styles.singleExercisePlaceholder,
                          { fontSize: dynamic.textSize },
                        ]}
                        numberOfLines={1}
                      >
                        {selectedExercise || 'חפשי את התרגיל'}
                      </Text>
                    </Pressable>

                    {selectedExercise !== '' && (
                      <View style={styles.deleteWrapper}>
                        <Pressable
                          onPress={() => handleDeleteExercise(selectedExercise)}
                          disabled={isDeleting}
                          hitSlop={12}
                          style={({ pressed }) => [
                            styles.deleteButton,
                            isDeleting && styles.deleteButtonDisabled,
                            pressed && { opacity: 0.82 },
                          ]}
                        >
                          <DeleteIcon size={18} color="#DC2626" />
                          <Text style={styles.deleteButtonText}>
                            {isDeleting ? 'מוחק...' : 'מחקי תרגיל'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                {selectedExercise !== '' && (
                  <View style={styles.section}>
                    <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>מה להציג</Text>
                    <ModalSelector
                      data={[
                        { key: 0, label: 'חזרות', value: 'חזרות' },
                        { key: 1, label: 'סטים', value: 'סטים' },
                        { key: 2, label: 'משקל', value: 'משקל' },
                        { key: 3, label: 'נפח אימון', value: 'נפח אימון' },
                      ]}
                      onChange={(option) => {
                        setDataType(option.value);
                      }}
                      cancelText="ביטול"
                      optionContainerStyle={selectorBoxStyle}
                      optionTextStyle={(text: string) => ({
                        fontSize: dynamic.selectorFont,
                        textAlign: textAlignByLanguage(text),
                      })}
                      overlayStyle={styles.modalOverlay}
                      cancelStyle={styles.modalCancelButton}
                      cancelTextStyle={styles.modalCancelText}
                    >
                      <View style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}>
                        {selectorRow({
                          value: dataType,
                          placeholder: 'בחרי נתון',
                          fontSize: dynamic.textSize,
                        })}
                      </View>
                    </ModalSelector>
                  </View>
                )}

                {dataType !== '' && (
                  <View style={styles.section}>
                    <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>סוג גרף</Text>
                    <ModalSelector
                      data={[
                        { key: 0, label: 'גרף קווי', value: 'קווי' },
                        { key: 1, label: 'גרף עמודות', value: 'עמודות' },
                      ]}
                      onChange={(option) => setChartType(option.value)}
                      cancelText="ביטול"
                      optionContainerStyle={selectorBoxStyle}
                      optionTextStyle={(text: string) => ({
                        fontSize: dynamic.selectorFont,
                        textAlign: textAlignByLanguage(text),
                      })}
                      overlayStyle={styles.modalOverlay}
                      cancelStyle={styles.modalCancelButton}
                      cancelTextStyle={styles.modalCancelText}
                    >
                      <View style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}>
                        {selectorRow({
                          value: chartType,
                          placeholder: 'בחרי סוג גרף',
                          fontSize: dynamic.textSize,
                        })}
                      </View>
                    </ModalSelector>
                  </View>
                )}

                {loading && (
                  <View style={styles.loaderWrapper}>
                    <ActivityIndicator size="large" color="#0F172A" />
                    <Text style={[styles.loaderText, { fontSize: dynamic.textSize - 1 }]}>
                      טוען נתונים...
                    </Text>
                  </View>
                )}

                {!loading && selectedExercise && dataType && chartType && chartData.labels.length > 0 && (
                  <View style={styles.graphSection}>
                    <Text style={[styles.graphTitle, { fontSize: dynamic.labelSize + 2 }]}>
                      גרף התקדמות
                    </Text>

                    <Text style={[styles.graphSubTitle, { fontSize: dynamic.textSize - 1 }]}>
                      מגמה לפי: {dataType}
                    </Text>

                    <View style={styles.metricTag}>
                      <Text style={styles.metricTagText}>{metricText}</Text>
                    </View>

                    <View style={styles.graphActionsRow}>
                      <Pressable
                        onPress={openFullScreenChart}
                        style={({ pressed }) => [
                          styles.expandButton,
                          pressed && styles.expandButtonPressed,
                        ]}
                      >
                        <ExpandIcon size={16} color="#0F172A" />
                        <Text style={styles.expandButtonText}>הגדל גרף</Text>
                      </Pressable>
                    </View>

                    <View style={styles.graphCard} collapsable={false}>
                      <Text style={styles.yAxisTitle}>{yAxisText}</Text>

                      <View style={styles.chartViewport} collapsable={false}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator
                          ref={scrollRef}
                          contentContainerStyle={styles.chartScrollContent}
                          removeClippedSubviews={false}
                        >
                          {renderRegularChart()}
                        </ScrollView>
                      </View>

                      <Text style={styles.scrollHint}>גללי הצידה כדי לראות תאריכים נוספים</Text>
                    </View>
                  </View>
                )}

                {!loading && chartData.labels.length === 0 && selectedExercise && dataType && chartType && (
                  <View style={styles.emptyState}>
                    <ChartIcon size={28} color="#64748B" />
                    <Text style={[styles.noData, { fontSize: dynamic.textSize - 1 }]}>
                      אין נתונים להצגה עבור הבחירה הנוכחית
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </AppLayout>

        <Modal
          visible={exerciseModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeExerciseModal}
        >
          <View style={styles.exerciseModalOverlay}>
            <View style={styles.exerciseModalCard}>
              <Text style={styles.exerciseModalTitle}>חפשי את התרגיל</Text>

              <TextInput
                style={styles.exerciseModalSearchInput}
                placeholder="הקלידי שם תרגיל"
                placeholderTextColor="#94A3B8"
                value={exerciseSearchText}
                onChangeText={setExerciseSearchText}
                textAlign="right"
                autoFocus
              />

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.exerciseResultsScroll}
              >
                {filteredExercises.length > 0 ? (
                  filteredExercises.slice(0, 30).map((exerciseName, index) => {
                    const isSelected =
                      normalizeText(selectedExercise) === normalizeText(exerciseName);

                    return (
                      <Pressable
                        key={`${exerciseName}-${index}`}
                        onPress={() => chooseExercise(exerciseName)}
                        style={({ pressed }) => [
                          styles.exerciseResultRow,
                          isSelected && styles.exerciseResultRowActive,
                          pressed && styles.exerciseResultRowPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.exerciseResultText,
                            isSelected && styles.exerciseResultTextActive,
                          ]}
                        >
                          {exerciseName}
                        </Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.noExercisesWrap}>
                    <Text style={styles.noExercisesText}>לא נמצאו תרגילים</Text>
                  </View>
                )}
              </ScrollView>

              <Pressable onPress={closeExerciseModal} style={styles.exerciseModalCloseButton}>
                <Text style={styles.exerciseModalCloseText}>סגירה</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {isFullScreenChartVisible && (
          <View style={styles.fullScreenOverlay}>
            <View style={styles.fakeLandscapeRoot}>
              <Pressable
                onPress={closeFullScreenChart}
                style={({ pressed }) => [
                  styles.fullScreenExitButton,
                  pressed && styles.fullScreenExitButtonPressed,
                ]}
                hitSlop={16}
              >
                <CloseIcon size={22} color="#FFFFFF" />
              </Pressable>

              <View style={styles.fakeLandscapeHeaderTextWrap}>
                <Text style={styles.fakeLandscapeTitle}>גרף התקדמות</Text>
                <Text style={styles.fakeLandscapeSubtitle}>
                  {selectedExercise} · {selectedPeriod} · {metricText}
                </Text>
              </View>

              <View style={styles.fakeLandscapeInfoRow}>
                <View style={styles.fakeLandscapeMetricTag}>
                  <Text style={styles.fakeLandscapeMetricTagText}>{yAxisText}</Text>
                </View>
                <Text style={styles.fakeLandscapeHintTop}>
                  התאריכים כאן מוצגים לפי תחילת כל תקופה כדי שיהיה יותר ברור
                </Text>
              </View>

              <View style={styles.fakeLandscapeStage}>
                <View
                  style={[
                    styles.rotatedCanvasWrap,
                    {
                      width: height,
                      height: width,
                      transform: [{ rotate: '90deg' }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rotatedCanvasInner,
                      {
                        width: height,
                        height: width,
                      },
                    ]}
                  >
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator
                      ref={fullScreenScrollRef}
                      contentContainerStyle={styles.fullScreenChartScrollContent}
                      removeClippedSubviews={false}
                    >
                      {renderFullScreenChart()}
                    </ScrollView>
                  </View>
                </View>
              </View>

              <Text style={styles.fakeLandscapeBottomHint}>
                לחצי על ה־X כדי לצאת מהגרף המוגדל
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
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
    padding: 20,
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
    marginTop: 6,
  },
  section: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textAlign: 'right',
  },
  inputBox: {
    borderWidth: 1,
    borderColor: '#D7DFE9',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  singleExerciseBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  singleExerciseBoxPressed: {
    opacity: 0.88,
  },
  singleExerciseText: {
    flex: 1,
    textAlign: 'right',
    color: '#111827',
  },
  singleExercisePlaceholder: {
    flex: 1,
    textAlign: 'right',
    color: '#8A94A6',
  },
  selectorInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    flex: 1,
    textAlign: 'right',
    color: '#111827',
  },
  selectorPlaceholderText: {
    flex: 1,
    textAlign: 'right',
    color: '#94A3B8',
  },
  deleteWrapper: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  deleteButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  loaderWrapper: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loaderText: {
    marginTop: 10,
    color: '#64748B',
  },
  graphSection: {
    marginTop: 10,
  },
  graphTitle: {
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
    textAlign: 'right',
  },
  graphSubTitle: {
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 10,
  },
  metricTag: {
    alignSelf: 'center',
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  metricTagText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  graphActionsRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  expandButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  expandButtonPressed: {
    opacity: 0.86,
  },
  expandButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  graphCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
  },
  yAxisTitle: {
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  chartViewport: {
    width: '100%',
  },
  chartScrollContent: {
    paddingHorizontal: 4,
  },
  chart: {
    borderRadius: 16,
  },
  scrollHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyState: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  noData: {
    marginTop: 8,
    color: '#64748B',
    textAlign: 'center',
  },
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCancelButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 10,
    paddingVertical: 12,
  },
  modalCancelText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#111827',
  },
  exerciseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  exerciseModalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  exerciseModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 14,
  },
  exerciseModalSearchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#111827',
    textAlign: 'right',
    fontSize: 16,
    marginBottom: 12,
  },
  exerciseResultsScroll: {
    maxHeight: 360,
  },
  exerciseResultRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exerciseResultRowActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#BFDBFE',
  },
  exerciseResultRowPressed: {
    opacity: 0.82,
  },
  exerciseResultText: {
    textAlign: 'right',
    color: '#111827',
    fontSize: 15,
  },
  exerciseResultTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  noExercisesWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noExercisesText: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
  },
  exerciseModalCloseButton: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseModalCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
    backgroundColor: '#0F172A',
  },
  fakeLandscapeRoot: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  fullScreenExitButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 50,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 12,
  },
  fullScreenExitButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  fakeLandscapeHeaderTextWrap: {
    position: 'absolute',
    top: 20,
    right: 14,
    left: 78,
    zIndex: 20,
  },
  fakeLandscapeTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  fakeLandscapeSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  fakeLandscapeInfoRow: {
    position: 'absolute',
    top: 78,
    left: 14,
    right: 14,
    zIndex: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fakeLandscapeMetricTag: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  fakeLandscapeMetricTagText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 12,
  },
  fakeLandscapeHintTop: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    textAlign: 'left',
  },
  fakeLandscapeStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rotatedCanvasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatedCanvasInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullScreenChartScrollContent: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  fullScreenChart: {
    borderRadius: 16,
  },
  fakeLandscapeBottomHint: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
  },
});