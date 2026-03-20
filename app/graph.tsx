import React, { useEffect, useState, useRef, useMemo } from 'react';
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
} from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import AppLayout from './components/AppLayout';
import { auth, db } from '../database/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { LineChart, BarChart } from 'react-native-chart-kit';
import ModalSelector from 'react-native-modal-selector';

const { height: screenHeight } = Dimensions.get('window');

const timeOptions = {
  'כל הזמנים (יומי)': 'all',
  'דו שבועי': 14,
  'חודשי': 30,
  'רבעוני': 90,
  'חצי שנתי': 182,
  'שנתי': 365,
};

export default function GraphScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 360;

  const dynamic = useMemo(() => {
    const horizontalPadding = width * 0.05;
    const cardWidth = Math.min(width * 0.92, 520);
    const inputHeight = isSmallScreen ? 46 : 50;
    const titleSize = width < 380 ? 22 : 26;
    const labelSize = width < 380 ? 14 : 15;
    const textSize = width < 380 ? 14 : 16;

    return {
      horizontalPadding,
      cardWidth,
      inputHeight,
      titleSize,
      labelSize,
      textSize,
    };
  }, [width, isSmallScreen]);

  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [dataType, setDataType] = useState('');
  const [chartType, setChartType] = useState('');
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ labels: string[]; datasets: { data: number[] }[] }>({
    labels: [],
    datasets: [{ data: [] }],
  });

  const scrollRef = useRef<ScrollView | null>(null);

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
        r: '4',
        strokeWidth: '2',
        stroke: '#0F172A',
      },
      strokeWidth: 2,
      barPercentage: 0.7,
      fillShadowGradient: '#0F172A',
      fillShadowGradientOpacity: 0.18,
    }),
    []
  );

  const textAlignByLanguage = (text: string) => (/[a-zA-Z]/.test(text) ? 'left' : 'right');

  const parseWorkoutDate = (dateValue: any) => {
    if (!dateValue) return null;

    if (dateValue?.toDate) {
      return dateValue.toDate();
    }

    if (dateValue instanceof Date) {
      return dateValue;
    }

    if (typeof dateValue === 'string') {
      const simpleDateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (simpleDateMatch) {
        const [, year, month, day] = simpleDateMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }

      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  };

  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getFormattedDateLabel = (date: Date) => {
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  useEffect(() => {
    const fetchExercises = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const q = query(collection(db, 'exercises'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        const names = snapshot.docs.map((docItem) => docItem.data().exerciseName).filter(Boolean);
        setAvailableExercises([...new Set(names)]);
      } catch (error) {
        console.error('Error fetching exercises:', error);
      }
    };

    fetchExercises();
  }, []);

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
        let filteredWorkouts = snapshot.docs.map((docItem) => docItem.data());

        const daysBack = timeOptions[selectedPeriod as keyof typeof timeOptions];
        if (daysBack !== 'all') {
          const sinceDate = startOfDay(new Date());
          sinceDate.setDate(sinceDate.getDate() - Number(daysBack));

          filteredWorkouts = filteredWorkouts.filter((workout: any) => {
            const workoutDate = parseWorkoutDate(workout.date);
            if (!workoutDate) return false;
            return startOfDay(workoutDate) >= sinceDate;
          });
        }

        generateChartData(filteredWorkouts);
      } catch (error) {
        console.error('Error fetching workout data:', error);
        setChartData({ labels: [], datasets: [{ data: [] }] });
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutData();
  }, [selectedPeriod, selectedExercise, dataType]);

  const generateChartData = (filteredWorkouts: any[]) => {
    const groupedMap: Record<
      string,
      { label: string; sortValue: number; values: number[] }
    > = {};

    const getBucketData = (date: Date) => {
      const d = startOfDay(date);

      switch (selectedPeriod) {
        case 'כל הזמנים (יומי)': {
          return {
            key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
            label: getFormattedDateLabel(d),
            sortValue: d.getTime(),
          };
        }

        case 'דו שבועי': {
          const start = new Date(d);
          start.setDate(d.getDate() - ((d.getDate() - 1) % 14));
          start.setHours(0, 0, 0, 0);

          return {
            key: `biweekly-${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`,
            label: getFormattedDateLabel(start),
            sortValue: start.getTime(),
          };
        }

        case 'חודשי': {
          const start = new Date(d.getFullYear(), d.getMonth(), 1);

          return {
            key: `month-${start.getFullYear()}-${start.getMonth() + 1}`,
            label: getFormattedDateLabel(start),
            sortValue: start.getTime(),
          };
        }

        case 'רבעוני': {
          const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
          const start = new Date(d.getFullYear(), quarterStartMonth, 1);

          return {
            key: `quarter-${d.getFullYear()}-${quarterStartMonth}`,
            label: getFormattedDateLabel(start),
            sortValue: start.getTime(),
          };
        }

        case 'חצי שנתי': {
          const startMonth = d.getMonth() < 6 ? 0 : 6;
          const start = new Date(d.getFullYear(), startMonth, 1);

          return {
            key: `half-${d.getFullYear()}-${startMonth}`,
            label: getFormattedDateLabel(start),
            sortValue: start.getTime(),
          };
        }

        case 'שנתי': {
          const start = new Date(d.getFullYear(), 0, 1);

          return {
            key: `year-${d.getFullYear()}`,
            label: getFormattedDateLabel(start),
            sortValue: start.getTime(),
          };
        }

        default: {
          return {
            key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
            label: getFormattedDateLabel(d),
            sortValue: d.getTime(),
          };
        }
      }
    };

    filteredWorkouts.forEach((w: any) => {
      if (w.exerciseName !== selectedExercise) return;

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

    const labels = sortedBuckets.map((item) => item.label);
    const data = sortedBuckets.map((item) => {
      const values = item.values;
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    setChartData({
      labels,
      datasets: [{ data }],
    });
  };

  const handleDeleteExercise = async (exerciseName: string) => {
    Alert.alert(
      'אישור מחיקה',
      'מחיקת תרגיל מהרשימה תגרום למחיקה לצמיתות. האם אתה בטוח?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק לצמיתות',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;

              setAvailableExercises((prev) => prev.filter((e) => e !== exerciseName));
              setSelectedExercise('');
              setDataType('');
              setChartType('');
              setChartData({ labels: [], datasets: [{ data: [] }] });

              const q = query(
                collection(db, 'exercises'),
                where('uid', '==', user.uid),
                where('exerciseName', '==', exerciseName)
              );

              const snapshot = await getDocs(q);

              for (const docSnap of snapshot.docs) {
                await deleteDoc(doc(db, 'exercises', docSnap.id));
              }
            } catch (error) {
              console.error('Error deleting exercise:', error);
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded) return null;

  const chartViewportWidth = Math.max(dynamic.cardWidth - 28, 260);
  const chartWidth = Math.max(chartViewportWidth, chartData.labels.length * 86);

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      width: chartWidth,
      height: 250,
      fromZero: true,
      yAxisLabel: '',
      yAxisSuffix: dataType === 'משקל' ? ' ק"ג' : '',
      chartConfig,
      verticalLabelRotation: 0,
      style: styles.chart,
      withInnerLines: true,
      withOuterLines: false,
      segments: 5,
    };

    return chartType === 'קווי' ? (
      <LineChart {...commonProps} bezier />
    ) : (
      <BarChart {...commonProps} />
    );
  };

  const selectorBoxStyle = {
    width: width * 0.9,
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
      <MaterialIcons name="keyboard-arrow-down" size={22} color="#5B6470" />
      <Text
        style={[
          value ? styles.selectorText : styles.selectorPlaceholderText,
          { fontSize },
        ]}
        numberOfLines={1}
      >
        {value || placeholder}
      </Text>
    </View>
  );

  return (
    <AppLayout>
      <View style={styles.screen}>
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
                  setSelectedExercise('');
                  setDataType('');
                  setChartType('');
                  setChartData({ labels: [], datasets: [{ data: [] }] });
                }}
                cancelText="ביטול"
                optionContainerStyle={selectorBoxStyle}
                optionTextStyle={(text: string) => ({
                  fontSize: 18,
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
                <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>תרגיל</Text>
                <ModalSelector
                  data={availableExercises
                    .sort((a, b) => a.localeCompare(b))
                    .map((label, index) => ({ key: index, label, value: label }))}
                  onChange={(option) => {
                    setSelectedExercise(option.value);
                    setDataType('');
                    setChartType('');
                    setChartData({ labels: [], datasets: [{ data: [] }] });
                  }}
                  cancelText="ביטול"
                  optionContainerStyle={selectorBoxStyle}
                  optionTextStyle={(text: string) => ({
                    fontSize: 18,
                    textAlign: textAlignByLanguage(text),
                  })}
                  overlayStyle={styles.modalOverlay}
                  cancelStyle={styles.modalCancelButton}
                  cancelTextStyle={styles.modalCancelText}
                >
                  <View style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}>
                    {selectorRow({
                      value: selectedExercise,
                      placeholder: 'בחרי תרגיל',
                      fontSize: dynamic.textSize,
                    })}
                  </View>
                </ModalSelector>

                {selectedExercise !== '' && (
                  <View style={styles.deleteWrapper}>
                    <Pressable
                      onPress={() => handleDeleteExercise(selectedExercise)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#DC2626" />
                      <Text style={styles.deleteButtonText}>מחקי תרגיל</Text>
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
                  ]}
                  onChange={(option) => {
                    setDataType(option.value);
                    setChartType('');
                    setChartData({ labels: [], datasets: [{ data: [] }] });
                  }}
                  cancelText="ביטול"
                  optionContainerStyle={selectorBoxStyle}
                  optionTextStyle={(text: string) => ({
                    fontSize: 18,
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
                    fontSize: 18,
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
                  <Text style={styles.metricTagText}>
                    {dataType === 'חזרות'
                      ? 'ממוצע חזרות'
                      : dataType === 'סטים'
                      ? 'כמות סטים'
                      : 'ממוצע משקל'}
                  </Text>
                </View>

                <View style={styles.graphCard}>
                  <Text style={styles.yAxisTitle}>
                    {dataType === 'חזרות'
                      ? 'ממוצע חזרות'
                      : dataType === 'סטים'
                      ? 'מספר סטים'
                      : 'משקל (ק"ג)'}
                  </Text>

                  <View style={styles.chartViewport}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator
                      ref={scrollRef}
                      contentContainerStyle={styles.chartScrollContent}
                    >
                      {renderChart()}
                    </ScrollView>
                  </View>

                  <Text style={styles.scrollHint}>גללי הצידה כדי לראות תאריכים נוספים</Text>
                </View>
              </View>
            )}

            {!loading && chartData.labels.length === 0 && selectedExercise && (
              <View style={styles.emptyState}>
                <MaterialIcons name="insert-chart-outlined" size={28} color="#64748B" />
                <Text style={[styles.noData, { fontSize: dynamic.textSize - 1 }]}>
                  אין נתונים להצגה עבור הבחירה הנוכחית
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </AppLayout>
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
    justifyContent: 'center',
  },

  selectorInnerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectorText: {
    flex: 1,
    color: '#111827',
    textAlign: 'right',
    marginRight: 8,
  },

  selectorPlaceholderText: {
    flex: 1,
    color: '#8A94A6',
    textAlign: 'right',
    marginRight: 8,
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
    borderRadius: 16,
  },

  deleteButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },

  loaderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
  },

  loaderText: {
    marginTop: 10,
    color: '#64748B',
    textAlign: 'center',
  },

  graphSection: {
    marginTop: 6,
  },

  graphTitle: {
    textAlign: 'right',
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },

  graphSubTitle: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 12,
  },

  metricTag: {
    alignSelf: 'center',
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  metricTagText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },

  graphCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },

  yAxisTitle: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
    fontSize: 14,
  },

  chartViewport: {
    width: '100%',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },

  chartScrollContent: {
    paddingHorizontal: 4,
  },

  chart: {
    borderRadius: 18,
    marginTop: 8,
    marginBottom: 8,
  },

  scrollHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },

  emptyState: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  noData: {
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
  },

  modalOverlay: {
    backgroundColor: 'rgba(15,23,42,0.35)',
  },

  modalCancelButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 10,
  },

  modalCancelText: {
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'center',
  },
});