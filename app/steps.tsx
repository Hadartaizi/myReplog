import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from './components/AppLayout';
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

const APP_BG = '#F4F7FB';

export default function Steps() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 360;

  const dynamic = useMemo(() => {
    const horizontalPadding = width * 0.05;
    const cardWidth = Math.min(width * 0.92, 520);
    const inputHeight = isSmallScreen ? 46 : 50;
    const titleSize = width < 380 ? 22 : 26;
    const labelSize = width < 380 ? 14 : 15;
    const textSize = width < 380 ? 14 : 16;
    const buttonHeight = isSmallScreen ? 44 : 48;

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

  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [filteredWorkouts, setFilteredWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [originalWorkout, setOriginalWorkout] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [collapsedCards, setCollapsedCards] = useState({});

  const getDateKey = (date) => date.toLocaleDateString('he-IL');

  const buildCollapsedState = (workouts) => {
    const initialCollapsed = {};
    workouts.forEach((workout) => {
      initialCollapsed[workout.id] = true;
    });
    setCollapsedCards(initialCollapsed);
  };

  const fetchWorkoutsByDate = useCallback(async (date, options = { silent: false }) => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    try {
      if (!options.silent) {
        setLoading(true);
      }

      const selectedDateKey = getDateKey(date);

      const q = query(
        collection(db, 'workouts'),
        where('uid', '==', user.uid),
        where('dateKey', '==', selectedDateKey)
      );

      const snapshot = await getDocs(q);

      const workouts = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      setFilteredWorkouts(workouts);
      buildCollapsedState(workouts);
      setEditingId(null);
      setOriginalWorkout(null);
      setErrorMessage('');
    } catch (error) {
      console.error('Error fetching workouts by date:', error);
      setFilteredWorkouts([]);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    fetchWorkoutsByDate(selectedDate);
  }, [selectedDate, fetchWorkoutsByDate]);

  const onDateChange = (_event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
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
        if (w.id !== workoutId) return w;

        const updated = { ...w, [field]: value };

        if (field === 'numSets') {
          const cleanedValue = String(value).replace(/[^0-9]/g, '');
          const newCount = parseInt(cleanedValue, 10);

          updated.numSets = cleanedValue;

          if (isNaN(newCount) || newCount < 0) return w;

          if (newCount > 10) {
            setErrorMessage('לא ניתן להוסיף יותר מ-10 סטים');
            return w;
          }

          setErrorMessage('');

          const currentSets = w.repsPerSet || {};
          const updatedSets = {};

          for (let i = 0; i < newCount; i++) {
            updatedSets[i] = currentSets[i] || { reps: '', weight: '' };
          }

          updated.repsPerSet = updatedSets;
        }

        return updated;
      })
    );
  };

  const handleRepsWeightChange = (workoutId, setIndex, field, value) => {
    const cleanedValue =
      field === 'reps'
        ? value.replace(/[^0-9]/g, '')
        : value.replace(/[^0-9.]/g, '');

    setFilteredWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== workoutId) return w;

        return {
          ...w,
          repsPerSet: {
            ...w.repsPerSet,
            [setIndex]: {
              ...(w.repsPerSet?.[setIndex] || {}),
              [field]: cleanedValue,
            },
          },
        };
      })
    );
  };

  const saveWorkout = (workout) => {
    Alert.alert('אישור שמירה', 'האם אתה בטוח שברצונך לשמור את השינויים?', [
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
            fetchWorkoutsByDate(selectedDate, { silent: true });
          } catch (error) {
            console.error('Error saving workout:', error);
          }
        },
      },
    ]);
  };

  const deleteWorkout = (workoutId) => {
    Alert.alert('אישור מחיקה', 'האם אתה בטוח שברצונך למחוק את התרגיל?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'workouts', workoutId));
            setFilteredWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
          } catch (error) {
            console.error('Error deleting workout:', error);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <AppLayout>
        <View style={styles.screen}>
          <ScrollView
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
                styles.mainCard,
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
                  מעקב אחר אימונים
                </Text>

                <Text style={[styles.subtitle, { fontSize: dynamic.textSize - 1 }]}>
                  צפייה, עריכה ומחיקה של אימונים לפי תאריך
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>בחר תאריך</Text>

                <Pressable
                  style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="calendar-today" size={20} color="#5B6470" />
                  <Text style={[styles.inputText, { fontSize: dynamic.textSize }]}>
                    {selectedDate.toLocaleDateString('he-IL')}
                  </Text>
                </Pressable>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )}
              </View>

              {loading && (
                <View style={styles.inlineLoader}>
                  <ActivityIndicator size="small" color="#0F172A" />
                  <Text style={styles.inlineLoaderText}>טוען אימונים...</Text>
                </View>
              )}

              {!hasLoadedOnce ? (
                <View style={styles.inlineLoaderFirst}>
                  <ActivityIndicator size="large" color="#0F172A" />
                </View>
              ) : filteredWorkouts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Icon name="event-busy" size={28} color="#64748B" />
                  <Text style={[styles.noWorkoutText, { fontSize: dynamic.textSize - 1 }]}>
                    לא בוצע אימון ביום זה
                  </Text>
                </View>
              ) : (
                filteredWorkouts.map((workout) => {
                  const isCollapsed = collapsedCards[workout.id];
                  const isEditing = editingId === workout.id;

                  return (
                    <View key={workout.id} style={styles.workoutCard}>
                      <Pressable
                        onPress={() => toggleCollapse(workout.id)}
                        style={styles.cardHeader}
                      >
                        <View style={styles.cardHeaderLeft}>
                          <Icon
                            name={isCollapsed ? 'expand-more' : 'expand-less'}
                            size={24}
                            color="#64748B"
                          />
                        </View>

                        <View style={styles.cardHeaderRight}>
                          <Text style={[styles.cardTitle, { fontSize: dynamic.textSize + 1 }]}>
                            {workout.exerciseName || 'תרגיל ללא שם'}
                          </Text>
                        </View>
                      </Pressable>

                      {!isCollapsed && (
                        <>
                          <View style={styles.sectionInner}>
                            <Text style={[styles.label, { fontSize: dynamic.labelSize }]}>
                              מספר סטים
                            </Text>

                            <TextInput
                              style={[
                                styles.inputBox,
                                styles.textInput,
                                { minHeight: dynamic.inputHeight, fontSize: dynamic.textSize },
                              ]}
                              value={String(workout.numSets ?? '')}
                              keyboardType="numeric"
                              onChangeText={(val) => handleFieldChange(workout.id, 'numSets', val)}
                              editable={isEditing}
                              textAlign="right"
                              placeholder="מספר סטים"
                              placeholderTextColor="#8A94A6"
                            />

                            {isEditing && errorMessage ? (
                              <Text style={[styles.errorText, { fontSize: dynamic.textSize - 2 }]}>
                                {errorMessage}
                              </Text>
                            ) : null}
                          </View>

                          {workout.repsPerSet &&
                            Object.keys(workout.repsPerSet).map((setIdx) => (
                              <View key={setIdx} style={styles.setCard}>
                                <Text style={[styles.setTitle, { fontSize: dynamic.labelSize }]}>
                                  סט {parseInt(setIdx, 10) + 1}
                                </Text>

                                <View style={styles.setInputsRow}>
                                  <View style={styles.setInputWrapper}>
                                    <Text style={styles.miniLabel}>חזרות</Text>
                                    <TextInput
                                      style={[
                                        styles.inputBox,
                                        styles.textInput,
                                        styles.smallInput,
                                        {
                                          minHeight: dynamic.inputHeight,
                                          fontSize: dynamic.textSize,
                                        },
                                      ]}
                                      value={String(workout.repsPerSet[setIdx]?.reps || '')}
                                      placeholder="לדוגמה 12"
                                      placeholderTextColor="#8A94A6"
                                      keyboardType="numeric"
                                      onChangeText={(val) =>
                                        handleRepsWeightChange(workout.id, setIdx, 'reps', val)
                                      }
                                      editable={isEditing}
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
                                        {
                                          minHeight: dynamic.inputHeight,
                                          fontSize: dynamic.textSize,
                                        },
                                      ]}
                                      value={String(workout.repsPerSet[setIdx]?.weight || '')}
                                      placeholder="לדוגמה 20"
                                      placeholderTextColor="#8A94A6"
                                      keyboardType="numeric"
                                      onChangeText={(val) =>
                                        handleRepsWeightChange(workout.id, setIdx, 'weight', val)
                                      }
                                      editable={isEditing}
                                      textAlign="right"
                                    />
                                  </View>
                                </View>
                              </View>
                            ))}

                          <View style={styles.actionsRow}>
                            {isEditing ? (
                              <>
                                <Pressable
                                  style={[
                                    styles.actionButton,
                                    styles.saveButton,
                                    { minHeight: dynamic.buttonHeight },
                                  ]}
                                  onPress={() => saveWorkout(workout)}
                                >
                                  <Text
                                    style={[
                                      styles.saveButtonText,
                                      { fontSize: dynamic.textSize - 1 },
                                    ]}
                                  >
                                    שמור
                                  </Text>
                                </Pressable>

                                <Pressable
                                  style={[
                                    styles.actionButton,
                                    styles.cancelButton,
                                    { minHeight: dynamic.buttonHeight },
                                  ]}
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
                                  <Text
                                    style={[
                                      styles.cancelButtonText,
                                      { fontSize: dynamic.textSize - 1 },
                                    ]}
                                  >
                                    חזור
                                  </Text>
                                </Pressable>
                              </>
                            ) : (
                              <Pressable
                                style={[
                                  styles.actionButton,
                                  styles.editButton,
                                  styles.fullWidthButton,
                                  { minHeight: dynamic.buttonHeight },
                                ]}
                                onPress={() => {
                                  setEditingId(workout.id);
                                  setOriginalWorkout(JSON.parse(JSON.stringify(workout)));
                                }}
                              >
                                <Text
                                  style={[
                                    styles.editButtonText,
                                    { fontSize: dynamic.textSize - 1 },
                                  ]}
                                >
                                  ערוך
                                </Text>
                              </Pressable>
                            )}
                          </View>

                          <Pressable
                            style={[styles.deleteButton, { minHeight: dynamic.buttonHeight }]}
                            onPress={() => deleteWorkout(workout.id)}
                          >
                            <Text
                              style={[
                                styles.deleteButtonText,
                                { fontSize: dynamic.textSize - 1 },
                              ]}
                            >
                              מחק
                            </Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </AppLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
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
    backgroundColor: APP_BG,
  },

  mainCard: {
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

  sectionInner: {
    marginBottom: 14,
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

  inlineLoader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },

  inlineLoaderText: {
    color: '#64748B',
    fontSize: 14,
  },

  inlineLoaderFirst: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noWorkoutText: {
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
  },

  workoutCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },

  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  cardHeaderLeft: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
  },

  cardTitle: {
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'right',
  },

  setCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
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
    flexWrap: 'wrap',
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

  errorText: {
    color: '#DC2626',
    marginTop: 8,
    textAlign: 'right',
    fontWeight: '500',
  },

  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 12,
  },

  actionButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  fullWidthButton: {
    flex: undefined,
    width: '100%',
  },

  editButton: {
    backgroundColor: '#E2E8F0',
  },

  editButtonText: {
    color: '#1E293B',
    fontWeight: '800',
  },

  saveButton: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },

  saveButtonText: {
    color: '#166534',
    fontWeight: '800',
  },

  cancelButton: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },

  cancelButtonText: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  deleteButton: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButtonText: {
    color: '#DC2626',
    fontWeight: '800',
  },
});