import React, { useEffect, useState } from 'react';
import {
  Text,

  StyleSheet,
  Dimensions,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from './components/AppLayout';
import { useFonts } from 'expo-font';
import { auth, db } from '../database/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

const { width: screenWidth } = Dimensions.get('window');

export default function Steps() {
  const [fontsLoaded] = useFonts({
    Bilbo: require('../assets/fonts/Bilbo-Regular.ttf'),
  });

  const [loading, setLoading] = useState(true);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [originalWorkout, setOriginalWorkout] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [collapsedCards, setCollapsedCards] = useState({});

  useEffect(() => {
    const fetchWorkouts = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, 'workouts'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);

      const workouts = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        // סידור מהישן לחדש
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      setAllWorkouts(workouts);
      filterByDate(workouts, selectedDate);
      setLoading(false);
    };

    fetchWorkouts();
  }, []);

  const filterByDate = (workouts, date) => {
    const selectedStr = date.toLocaleDateString('he-IL');
    const filtered = workouts.filter(
      (w) => new Date(w.date).toLocaleDateString('he-IL') === selectedStr
    );
    setFilteredWorkouts(filtered);
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      filterByDate(allWorkouts, date);
    }
  };

  const toggleCollapse = (id) => {
    setCollapsedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleFieldChange = (workoutId, field, value) => {
    setFilteredWorkouts((prev) =>
      prev.map((w) => {
        if (w.id === workoutId) {
          const updated = { ...w, [field]: value };
          if (field === 'numSets') {
            const newCount = parseInt(value);
            if (isNaN(newCount) || newCount < 0) return w;
            if (newCount > 10) {
              setErrorMessage('לא ניתן להוסיף יותר מ-10 סטים');
              return w;
            } else {
              setErrorMessage('');
            }
            const currentSets = w.repsPerSet || {};
            const updatedSets = {};
            for (let i = 0; i < newCount; i++) {
              updatedSets[i] = currentSets[i] || { reps: '', weight: '' };
            }
            updated.repsPerSet = updatedSets;
          }
          return updated;
        }
        return w;
      })
    );
  };

  const handleRepsWeightChange = (workoutId, setIndex, field, value) => {
    setFilteredWorkouts((prev) =>
      prev.map((w) => {
        if (w.id === workoutId) {
          return {
            ...w,
            repsPerSet: {
              ...w.repsPerSet,
              [setIndex]: {
                ...(w.repsPerSet?.[setIndex] || {}),
                [field]: value,
              },
            },
          };
        }
        return w;
      })
    );
  };

  const saveWorkout = (workout) => {
    Alert.alert(
      'אישור שמירה',
      'האם אתה בטוח שברצונך לשמור את השינויים?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שמור',
          onPress: async () => {
            try {
              const docRef = doc(db, 'workouts', workout.id);
              const { id, ...dataToSave } = workout;
              await updateDoc(docRef, dataToSave);
              setEditingId(null);
              setOriginalWorkout(null);

              const updated = allWorkouts.map((w) =>
                w.id === workout.id ? { ...w, ...dataToSave } : w
              );
              setAllWorkouts(updated);
              filterByDate(updated, selectedDate);
            } catch (error) {
              console.error('Error saving workout:', error);
            }
          },
        },
      ]
    );
  };

  const deleteWorkout = (workoutId) => {
    Alert.alert(
      'אישור מחיקה',
      'האם אתה בטוח שברצונך למחוק את התרגיל?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'workouts', workoutId));
              const updated = allWorkouts.filter((w) => w.id !== workoutId);
              setAllWorkouts(updated);
              filterByDate(updated, selectedDate);
            } catch (error) {
              console.error('Error deleting workout:', error);
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded || loading)
    return <ActivityIndicator style={{ marginTop: 30 }} size="large" />;

  return (
    <AppLayout>
      <ScrollView
        contentContainerStyle={styles.container}
        horizontal={false}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>מעקב אחר אימונים</Text>

        <Text style={styles.label}>בחר תאריך:</Text>
        <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
          <View style={styles.dateInputRow}>
            <Text style={styles.dateText}>{selectedDate.toLocaleDateString('he-IL')}</Text>
            <Icon name="calendar-today" size={20} color="#666" style={styles.calendarIcon} />
          </View>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {filteredWorkouts.length === 0 ? (
          <Text style={styles.noWorkoutText}>לא בוצע אימון ביום זה</Text>
        ) : (
          filteredWorkouts.map((workout) => (
            <View key={workout.id} style={styles.cardLarge}>
              <Pressable onPress={() => toggleCollapse(workout.id)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{workout.exerciseName || 'תרגיל ללא שם'}</Text>
                  <Icon
                    name={collapsedCards[workout.id] ? 'expand-more' : 'expand-less'}
                    size={24}
                    color="#666"
                  />
                </View>
              </Pressable>

              {!collapsedCards[workout.id] && (
                <>
                  <Text style={styles.exerciseLabel}>מספר סטים:</Text>
                  <TextInput
                    style={styles.input}
                    value={String(workout.numSets)}
                    keyboardType="numeric"
                    onChangeText={(val) => handleFieldChange(workout.id, 'numSets', val)}
                    editable={editingId === workout.id}
                  />
                  {editingId === workout.id && errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}

                  {workout.repsPerSet &&
                    Object.keys(workout.repsPerSet).map((setIdx) => (
                      <View key={setIdx} style={styles.setRow}>
                        <Text style={styles.setLabel}>סט {parseInt(setIdx) + 1}</Text>
                        <TextInput
                          style={styles.inlineInput}
                          value={String(workout.repsPerSet[setIdx].reps || '')}
                          placeholder="חזרות"
                          keyboardType="numeric"
                          onChangeText={(val) =>
                            handleRepsWeightChange(workout.id, setIdx, 'reps', val)
                          }
                          editable={editingId === workout.id}
                        />
                        <TextInput
                          style={styles.inlineInput}
                          value={String(workout.repsPerSet[setIdx].weight || '')}
                          placeholder="משקל"
                          keyboardType="numeric"
                          onChangeText={(val) =>
                            handleRepsWeightChange(workout.id, setIdx, 'weight', val)
                          }
                          editable={editingId === workout.id}
                        />
                      </View>
                    ))}

                  {editingId === workout.id ? (
                    <>
                      <Pressable
                        style={styles.saveButton}
                        onPress={() => saveWorkout(workout)}
                      >
                        <Text style={styles.saveButtonText}>שמור</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cancelButton}
                        onPress={() => {
                          setFilteredWorkouts((prev) =>
                            prev.map((w) =>
                              w.id === workout.id ? originalWorkout || w : w
                            )
                          );
                          setEditingId(null);
                          setOriginalWorkout(null);
                          setErrorMessage('');
                        }}
                      >
                        <Text style={styles.cancelButtonText}>חזור</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={styles.editButton}
                      onPress={() => {
                        setEditingId(workout.id);
                        setOriginalWorkout(JSON.parse(JSON.stringify(workout)));
                      }}
                    >
                      <Text style={styles.editButtonText}>ערוך</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteWorkout(workout.id)}
                  >
                    <Text style={styles.deleteButtonText}>מחק</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 20,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'right',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    width: '100%',
    alignSelf: 'center',
  },
  dateInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    textAlign: 'right',
  },
  calendarIcon: {
    marginLeft: 10,
  },
  noWorkoutText: {
    fontSize: 16,
    color: 'gray',
    marginTop: 30,
    textAlign: 'center',
  },
  cardLarge: {
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    width: screenWidth - 40,
    alignSelf: 'center',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'right',
    flex: 1,
  },
  exerciseLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    textAlign: 'right',
  },
  setRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  setLabel: {
    width: 60,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  inlineInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 6,
    textAlign: 'right',
  },
  editButton: {
    backgroundColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  saveButton: {
backgroundColor: '#c8f7c8', 
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#ffdddd',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#c00',
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'right',
  },
  cancelButton: {
    backgroundColor: '#A9C6FF',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  saveButton: {
  backgroundColor: '#c8f7c8', // רקע ירוק בהיר
  padding: 10,
  borderRadius: 6,
  marginTop: 10,
  alignItems: 'center',
},
});
