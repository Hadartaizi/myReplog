import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  StyleSheet,
  Dimensions,
  View,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useFonts } from 'expo-font';
import AppLayout from './components/AppLayout';
import { auth, db } from '../database/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { LineChart, BarChart } from 'react-native-chart-kit';
import ModalSelector from 'react-native-modal-selector';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const timeOptions = {
  'כל הזמנים (יומי)': 'all',
  'דו שבועי': 14,
  'חודשי': 30,
  'רבעוני': 90,
  'חצי שנתי': 182,
  'שנתי': 365,
};

export default function GraphScreen() {
  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [dataType, setDataType] = useState('');
  const [chartType, setChartType] = useState('');
  const [availableExercises, setAvailableExercises] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({ labels: [], datasets: [{ data: [] }] });
  const [yMax, setYMax] = useState(0);

  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchExercises = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, 'exercises'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      const names = snapshot.docs.map(doc => doc.data().exerciseName);
      setAvailableExercises([...new Set(names)]);
    };

    fetchExercises();
  }, []);

  useEffect(() => {
    const fetchWorkoutData = async () => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user || !selectedExercise || !selectedPeriod) {
        setChartData({ labels: [], datasets: [{ data: [] }] });
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'workouts'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      let filteredWorkouts = snapshot.docs.map(doc => doc.data());

      const daysBack = timeOptions[selectedPeriod];
      if (daysBack !== 'all') {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - daysBack);
        filteredWorkouts = filteredWorkouts.filter(workout => new Date(workout.date) >= sinceDate);
      }

      setWorkouts(filteredWorkouts);
      generateChartData(filteredWorkouts);
      setLoading(false);
    };

    fetchWorkoutData();
  }, [selectedPeriod, selectedExercise, dataType]);

  const generateChartData = (filteredWorkouts) => {
    const dateMap = {};

    const groupDateKey = (date) => {
      const d = new Date(date);
      switch (selectedPeriod) {
        case 'כל הזמנים (יומי)':
        case 'יומי':
          return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
        case 'דו שבועי': {
          const start = new Date(d);
          start.setDate(d.getDate() - (d.getDate() % 14));
          return start.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
        }
        case 'חודשי':
          return d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
        case 'רבעוני':
        case 'חצי שנתי': {
          const quarter = Math.floor(d.getMonth() / (selectedPeriod === 'רבעוני' ? 3 : 6)) + 1;
          return `${d.getFullYear()} Q${quarter}`;
        }
        case 'שנתי':
          return d.getFullYear().toString();
        default:
          return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
      }
    };

    filteredWorkouts.forEach((w) => {
      if (w.exerciseName !== selectedExercise) return;

      const key = groupDateKey(w.date);
      const sets = Object.values(w.repsPerSet || {});
      if (sets.length === 0) return;

      let value = 0;
      if (dataType === 'חזרות') {
        const totalReps = sets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
        value = totalReps / sets.length;
      } else if (dataType === 'סטים') {
        value = parseInt(w.numSets) || 0;
      } else if (dataType === 'משקל') {
        const totalWeight = sets.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0);
        value = totalWeight / sets.length;
      }

      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(value);
    });

    const labels = Object.keys(dateMap).sort((a, b) => {
      if (selectedPeriod.includes('יומי') || selectedPeriod === 'דו שבועי') {
        const [da, ma] = a.split('.');
        const [db, mb] = b.split('.');
        return new Date(2023, parseInt(ma) - 1, parseInt(da)) - new Date(2023, parseInt(mb) - 1, parseInt(db));
      }
      return a.localeCompare(b);
    });

    const data = labels.map(label => {
      const values = dateMap[label];
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    const maxVal = Math.max(...data, 1);
    setYMax(Math.ceil(maxVal * 1.1));

    setChartData({
      labels,
      datasets: [{ data }],
    });
  };

  const handleDeleteExercise = async (exerciseName) => {
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

              setAvailableExercises(prev => prev.filter(e => e !== exerciseName));
              setSelectedExercise('');

              const q = query(
                collection(db, 'exercises'),
                where('uid', '==', user.uid),
                where('exerciseName', '==', exerciseName)
              );
              const snapshot = await getDocs(q);
              snapshot.forEach(async (docSnap) => {
                await deleteDoc(doc(db, 'exercises', docSnap.id));
              });
            } catch (error) {
              console.error('Error deleting exercise:', error);
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded) return null;

  const renderChart = () => {
    const chartWidth = Math.max(screenWidth * 0.9, chartData.labels.length * 60);

    const commonProps = {
      data: chartData,
      width: chartWidth,
      height: 220,
      fromZero: true,
      yAxisLabel: '',
      yAxisSuffix: dataType === 'משקל' ? ' ק"ג' : '',
      chartConfig: {
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        color: (opacity = 1) => `rgba(26, 26, 255, ${opacity})`,
        labelColor: () => '#000',
        propsForBackgroundLines: {
          strokeDasharray: '',
          stroke: '#ccc',
        },
        strokeWidth: 2,
      },
      verticalLabelRotation: 0,
      style: { borderRadius: 16, marginTop: 20, marginBottom: 40 },
    };

    return chartType === 'קווי' ? <LineChart {...commonProps} bezier /> : <BarChart {...commonProps} />;
  };

  const textAlignByLanguage = (text) => (/[a-zA-Z]/.test(text) ? 'left' : 'right');

  return (
    <AppLayout>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>מסך הגרפים</Text>

        {/* בחר תקופה */}
        <View style={styles.selectorContainer}>
          <Text style={styles.label}>בחר תקופה:</Text>
          <ModalSelector
            data={Object.keys(timeOptions).map((label, index) => ({ key: index, label, value: label }))}
            initValue={selectedPeriod || 'בחר'}
            onChange={(option) => setSelectedPeriod(option.value)}
            style={styles.selector}
            initValueTextStyle={styles.initText}
            selectTextStyle={styles.selectText}
            optionTextStyle={(text) => ({ fontSize: 18, textAlign: textAlignByLanguage(text) })}
            cancelText="ביטול"
            optionContainerStyle={{
              width: screenWidth * 0.90,
              maxHeight: screenHeight * 0.6, // ✅ דינמי
              alignSelf: 'center',
            }}
          />
        </View>

        {/* בחר תרגיל */}
        {selectedPeriod !== '' && (
          <View style={styles.selectorContainer}>
            <Text style={styles.label}>בחר תרגיל:</Text>
            <ModalSelector
              data={availableExercises
                .sort((a, b) => a.localeCompare(b))
                .map((label, index) => ({ key: index, label, value: label }))}
              initValue={selectedExercise || 'בחר'}
              onChange={(option) => setSelectedExercise(option.value)}
              style={styles.selector}
              initValueTextStyle={styles.initText}
              selectTextStyle={styles.selectText}
              optionTextStyle={(text) => ({ fontSize: 18, textAlign: textAlignByLanguage(text) })}
              cancelText="ביטול"
              optionContainerStyle={{
                width: screenWidth * 0.90,
                maxHeight: screenHeight * 0.6, // ✅ דינמי
                alignSelf: 'center',
              }}
            />

            {selectedExercise !== '' && (
              <View style={{ width: screenWidth * 0.70, marginTop: 5 }}>
                <Pressable onPress={() => handleDeleteExercise(selectedExercise)}>
                  <Text style={{ color: 'red', fontWeight: 'bold', textAlign: 'right' }}>מחק תרגיל</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* מה להציג */}
        {selectedExercise !== '' && (
          <View style={styles.selectorContainer}>
            <Text style={styles.label}>מה להציג?</Text>
            <ModalSelector
              data={[
                { key: 0, label: 'חזרות', value: 'חזרות' },
                { key: 1, label: 'סטים', value: 'סטים' },
                { key: 2, label: 'משקל', value: 'משקל' },
              ]}
              initValue={dataType || 'בחר'}
              onChange={(option) => setDataType(option.value)}
              style={styles.selector}
              initValueTextStyle={styles.initText}
              selectTextStyle={styles.selectText}
              optionTextStyle={(text) => ({ fontSize: 18, textAlign: textAlignByLanguage(text) })}
              cancelText="ביטול"
              optionContainerStyle={{
                width: screenWidth * 0.90,
                maxHeight: screenHeight * 0.6, // ✅ דינמי
                alignSelf: 'center',
              }}
            />
          </View>
        )}

        {/* סוג גרף */}
        {dataType !== '' && (
          <View style={styles.selectorContainer}>
            <Text style={styles.label}>סוג גרף:</Text>
            <ModalSelector
              data={[
                { key: 0, label: 'גרף קווי', value: 'קווי' },
                { key: 1, label: 'גרף עמודות', value: 'עמודות' },
              ]}
              initValue={chartType || 'בחר'}
              onChange={(option) => setChartType(option.value)}
              style={styles.selector}
              initValueTextStyle={styles.initText}
              selectTextStyle={styles.selectText}
              optionTextStyle={(text) => ({ fontSize: 18, textAlign: textAlignByLanguage(text) })}
              cancelText="ביטול"
              optionContainerStyle={{
                width: screenWidth * 0.90,
                maxHeight: screenHeight * 0.6, // ✅ דינמי
                alignSelf: 'center',
              }}
            />
          </View>
        )}

        {/* הצגת הגרף */}
        {selectedExercise && dataType && chartType && !loading && chartData.labels.length > 0 && (
          <>
            <Text style={styles.subTitle}>מגמה לפי: {dataType}</Text>
            <View style={styles.graphWrapper}>
              <Text style={styles.yAxisTitle}>
                {dataType === 'חזרות' ? 'סה"כ חזרות' : dataType === 'סטים' ? 'מספר סטים' : 'משקל (ק"ג)'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator ref={scrollRef} style={{ transform: [{ scaleX: -1 }] }}>
                <View style={{ transform: [{ scaleX: -1 }] }}>{renderChart()}</View>
              </ScrollView>
            </View>
          </>
        )}

        {loading && <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} />}
        {!loading && chartData.labels.length === 0 && selectedExercise && <Text style={styles.noData}>אין נתונים להצגה</Text>}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: screenWidth * 0.06,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  selectorContainer: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 5,
  },
  selector: {
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: '#fff',
    justifyContent: 'center',
    height: 40,
    width: screenWidth * 0.70,
  },
  initText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'right',
  },
  selectText: {
    fontSize: 18,
    color: '#000',
    textAlign: 'right',
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  noData: {
    fontSize: 16,
    color: 'gray',
    marginTop: 20,
  },
  graphWrapper: {
    alignItems: 'center',
  },
  yAxisTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
