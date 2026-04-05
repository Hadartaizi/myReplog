import React, { useEffect, useState, useMemo } from 'react';
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

const APP_BG = '#F4F7FB';

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateOnly = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getExerciseDisplayName = (workout: any) => {
  return (
    String(
      workout?.exerciseName ||
        workout?.name ||
        workout?.title ||
        ''
    ).trim() || 'תרגיל ללא שם'
  );
};

export default function Steps() {
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width < 360;
  const isTablet = width >= 768;
  const isLargeDesktop = width >= 1200;

  const dynamic = useMemo(() => {
    const horizontalPadding = width < 480 ? 16 : width < 768 ? 22 : 28;
    const cardWidth =
      width < 480 ? width - 24 : width < 768 ? width * 0.92 : Math.min(760, width * 0.8);
    const inputHeight = isSmallScreen ? 46 : 52;
    const titleSize = width < 380 ? 22 : width < 768 ? 26 : 30;
    const labelSize = width < 380 ? 14 : 15;
    const textSize = width < 380 ? 14 : width < 768 ? 16 : 17;
    const buttonHeight = isSmallScreen ? 44 : 50;

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

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalWorkout, setOriginalWorkout] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

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

  const buildCollapsedState = (workouts: any[]) => {
    const updatedCollapsed: Record<string, boolean> = {};
    workouts.forEach((workout) => {
      updatedCollapsed[workout.id] = true;
    });
    setCollapsedCards(updatedCollapsed);
  };

  const filterByDate = (workouts: any[], date: Date) => {
    const selectedOnly = normalizeDateOnly(date).getTime();

    const filtered = workouts.filter((w) => {
      const parsedDate = parseWorkoutDate(w.date);
      if (!parsedDate) return false;

      return normalizeDateOnly(parsedDate).getTime() === selectedOnly;
    });

    setFilteredWorkouts(filtered);
    buildCollapsedState(filtered);
  };

  useEffect(() => {
    const fetchWorkouts = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'workouts'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);

        const workouts = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();

            return {
              id: docSnap.id,
              ...data,
              exerciseName:
                data.exerciseName ||
                data.name ||
                data.title ||
                '',
            };
          })
          .sort((a: any, b: any) => {
            const aTime = parseWorkoutDate(a.date)?.getTime() || 0;
            const bTime = parseWorkoutDate(b.date)?.getTime() || 0;
            return aTime - bTime;
          });

        setAllWorkouts(workouts);
        filterByDate(workouts, selectedDate);
      } catch (error) {
        console.error('Error fetching workouts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, []);

  const openDatePicker = () => {
    if (Platform.OS === 'web') return;
    setTempDate(selectedDate);
    setShowDatePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
  };

  const onDateChange = (_event: any, date?: Date) => {
    if (!date || isNaN(date.getTime())) return;

    if (Platform.OS === 'ios') {
      setTempDate(date);
    } else {
      setSelectedDate(date);
      setTempDate(date);
      filterByDate(allWorkouts, date);
      setEditingId(null);
      setOriginalWorkout(null);
      setErrorMessage('');
      setShowDatePicker(false);
    }
  };

  const confirmIosDate = () => {
    setSelectedDate(tempDate);
    filterByDate(allWorkouts, tempDate);
    setEditingId(null);
    setOriginalWorkout(null);
    setErrorMessage('');
    setShowDatePicker(false);
  };

  const handleWebDateChange = (value: string) => {
    if (!value) {
      const today = new Date();
      setSelectedDate(today);
      setTempDate(today);
      filterByDate(allWorkouts, today);
      setEditingId(null);
      setOriginalWorkout(null);
      setErrorMessage('');
      return;
    }

    const newDate = new Date(`${value}T12:00:00`);
    if (isNaN(newDate.getTime())) return;

    setSelectedDate(newDate);
    setTempDate(newDate);
    filterByDate(allWorkouts, newDate);
    setEditingId(null);
    setOriginalWorkout(null);
    setErrorMessage('');
  };

  const toggleCollapse = (id: string) => {
    setCollapsedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleFieldChange = (workoutId: string, field: string, value: string) => {
    setFilteredWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== workoutId) return w;

        const updated = { ...w, [field]: value };

        if (field === 'numSets') {
          const cleanedValue = String(value).replace(/[^0-9]/g, '');
          updated.numSets = cleanedValue;

          if (cleanedValue === '') {
            updated.repsPerSet = {};
            setErrorMessage('');
            return updated;
          }

          const newCount = parseInt(cleanedValue, 10);

          if (isNaN(newCount) || newCount < 0) return w;

          if (newCount > 10) {
            setErrorMessage('לא ניתן להוסיף יותר מ-10 סטים');
            return w;
          }

          setErrorMessage('');
          const currentSets = w.repsPerSet || {};
          const updatedSets: Record<string, { reps: string; weight: string }> = {};

          for (let i = 0; i < newCount; i++) {
            updatedSets[i] = currentSets[i] || { reps: '', weight: '' };
          }

          updated.repsPerSet = updatedSets;
        }

        return updated;
      })
    );
  };

  const handleRepsWeightChange = (
    workoutId: string,
    setIndex: string,
    field: 'reps' | 'weight',
    value: string
  ) => {
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

  const confirmAction = async (title: string, message: string) => {
    if (Platform.OS === 'web') {
      return window.confirm(`${title}\n\n${message}`);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        {
          text: 'ביטול',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'אישור',
          onPress: () => resolve(true),
        },
      ]);
    });
  };

  const saveWorkout = async (workout: any) => {
    const confirmed = await confirmAction(
      'אישור שמירה',
      'האם אתה בטוח שברצונך לשמור את השינויים?'
    );

    if (!confirmed) return;

    try {
      setSavingId(workout.id);

      const docRef = doc(db, 'workouts', workout.id);
      const { id, ...dataToSave } = workout;

      await updateDoc(docRef, dataToSave);

      setEditingId(null);
      setOriginalWorkout(null);
      setErrorMessage('');

      const updated = allWorkouts.map((w) =>
        w.id === workout.id ? { ...w, ...dataToSave } : w
      );

      setAllWorkouts(updated);
      filterByDate(updated, selectedDate);
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('שגיאה', 'שמירת האימון נכשלה');
    } finally {
      setSavingId(null);
    }
  };

  const deleteWorkout = async (workoutId: string) => {
    const confirmed = await confirmAction(
      'אישור מחיקה',
      'האם אתה בטוח שברצונך למחוק את התרגיל?'
    );

    if (!confirmed) return;

    try {
      setDeletingId(workoutId);

      await deleteDoc(doc(db, 'workouts', workoutId));

      const updated = allWorkouts.filter((w) => w.id !== workoutId);
      setAllWorkouts(updated);
      filterByDate(updated, selectedDate);

      if (editingId === workoutId) {
        setEditingId(null);
        setOriginalWorkout(null);
        setErrorMessage('');
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
      Alert.alert('שגיאה', 'מחיקת האימון נכשלה');
    } finally {
      setDeletingId(null);
    }
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.root}>
        <AppLayout>
          <View style={styles.loaderScreen}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={styles.loaderText}>טוען אימונים...</Text>
          </View>
        </AppLayout>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppLayout>
        <View style={styles.screen}>
          <ScrollView
            keyboardShouldPersistTaps="always"
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
                  paddingHorizontal: width < 480 ? 16 : width * 0.04,
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

                {Platform.OS === 'web' ? (
                  <View style={[styles.inputBox, { minHeight: dynamic.inputHeight }]}>
                    <input
                      type="date"
                      value={formatDateForInput(selectedDate)}
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
                        {selectedDate.toLocaleDateString('he-IL')}
                      </Text>
                      <Text style={styles.dateHint}>לחצי כדי לשנות תאריך</Text>
                    </View>

                    <Text style={[styles.dateArrowText, styles.arrowDown]}>⌃</Text>
                  </Pressable>
                )}
              </View>

              {filteredWorkouts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateSymbol}>—</Text>
                  <Text style={[styles.noWorkoutText, { fontSize: dynamic.textSize - 1 }]}>
                    לא בוצע אימון ביום זה
                  </Text>
                </View>
              ) : (
                filteredWorkouts.map((workout) => {
                  const isCollapsed = collapsedCards[workout.id];
                  const isEditing = editingId === workout.id;
                  const canEditFields = isEditing;
                  const isSavingThis = savingId === workout.id;
                  const isDeletingThis = deletingId === workout.id;

                  return (
                    <View key={workout.id} style={styles.workoutCard}>
                      <Pressable onPress={() => toggleCollapse(workout.id)} style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <Text
                            style={[
                              styles.arrowText,
                              isCollapsed ? styles.arrowDown : styles.arrowUp,
                            ]}
                          >
                            ⌃
                          </Text>
                        </View>

                        <View style={styles.cardHeaderRight}>
                          {isEditing ? (
                            <TextInput
                              style={[
                                styles.inputBox,
                                styles.textInput,
                                {
                                  fontSize: dynamic.textSize + 1,
                                  minHeight: dynamic.inputHeight,
                                },
                              ]}
                              value={workout.exerciseName || workout.name || workout.title || ''}
                              onChangeText={(val) =>
                                handleFieldChange(workout.id, 'exerciseName', val)
                              }
                              editable={!isSavingThis && !isDeletingThis}
                              textAlign="right"
                              placeholder="שם התרגיל"
                              placeholderTextColor="#8A94A6"
                            />
                          ) : (
                            <Text style={[styles.cardTitle, { fontSize: dynamic.textSize + 1 }]}>
                              {getExerciseDisplayName(workout)}
                            </Text>
                          )}
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
                                {
                                  minHeight: dynamic.inputHeight,
                                  fontSize: dynamic.textSize,
                                },
                                !canEditFields && styles.disabledInput,
                              ]}
                              value={String(workout.numSets ?? '')}
                              keyboardType="numeric"
                              onChangeText={(val) => handleFieldChange(workout.id, 'numSets', val)}
                              editable={canEditFields && !isSavingThis && !isDeletingThis}
                              textAlign="right"
                              placeholder="מספר סטים"
                              placeholderTextColor="#8A94A6"
                            />

                            {errorMessage ? (
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

                                <View
                                  style={[
                                    styles.setInputsRow,
                                    isTablet || isLargeDesktop
                                      ? styles.setInputsRowWide
                                      : styles.setInputsRowMobile,
                                  ]}
                                >
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
                                        !canEditFields && styles.disabledInput,
                                      ]}
                                      value={String(workout.repsPerSet[setIdx]?.reps || '')}
                                      placeholder="לדוגמה 12"
                                      placeholderTextColor="#8A94A6"
                                      keyboardType="numeric"
                                      onChangeText={(val) =>
                                        handleRepsWeightChange(workout.id, setIdx, 'reps', val)
                                      }
                                      editable={canEditFields && !isSavingThis && !isDeletingThis}
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
                                        !canEditFields && styles.disabledInput,
                                      ]}
                                      value={String(workout.repsPerSet[setIdx]?.weight || '')}
                                      placeholder="לדוגמה 20"
                                      placeholderTextColor="#8A94A6"
                                      keyboardType="numeric"
                                      onChangeText={(val) =>
                                        handleRepsWeightChange(workout.id, setIdx, 'weight', val)
                                      }
                                      editable={canEditFields && !isSavingThis && !isDeletingThis}
                                      textAlign="right"
                                    />
                                  </View>
                                </View>
                              </View>
                            ))}

                          <View
                            style={[
                              styles.actionsRow,
                              width < 420 ? styles.actionsColumn : styles.actionsRowDesktop,
                            ]}
                          >
                            {isEditing ? (
                              <>
                                <Pressable
                                  style={[
                                    styles.actionButton,
                                    styles.saveButton,
                                    { minHeight: dynamic.buttonHeight },
                                    (isSavingThis || isDeletingThis) && styles.disabledButton,
                                    width < 420 && styles.fullWidthButton,
                                  ]}
                                  onPress={() => saveWorkout(workout)}
                                  disabled={isSavingThis || isDeletingThis}
                                >
                                  {isSavingThis ? (
                                    <ActivityIndicator size="small" color="#166534" />
                                  ) : (
                                    <Text
                                      style={[
                                        styles.saveButtonText,
                                        { fontSize: dynamic.textSize - 1 },
                                      ]}
                                    >
                                      שמור
                                    </Text>
                                  )}
                                </Pressable>

                                <Pressable
                                  style={[
                                    styles.actionButton,
                                    styles.cancelButton,
                                    { minHeight: dynamic.buttonHeight },
                                    (isSavingThis || isDeletingThis) && styles.disabledButton,
                                    width < 420 && styles.fullWidthButton,
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
                                  disabled={isSavingThis || isDeletingThis}
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
                                  setErrorMessage('');
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
                            style={[
                              styles.deleteButton,
                              { minHeight: dynamic.buttonHeight },
                              (isSavingThis || isDeletingThis) && styles.disabledButton,
                            ]}
                            onPress={() => deleteWorkout(workout.id)}
                            disabled={isSavingThis || isDeletingThis}
                          >
                            {isDeletingThis ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Text
                                style={[
                                  styles.deleteButtonText,
                                  { fontSize: dynamic.textSize - 1 },
                                ]}
                              >
                                מחק
                              </Text>
                            )}
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

      {showDatePicker && Platform.OS === 'android' && (
        <View style={styles.datePickerInlineWrapper}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="calendar"
            onChange={onDateChange}
          />
        </View>
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerInlineWrapper}>
          <View style={styles.iosPickerCard}>
            <Text style={styles.dateModalTitle}>בחרי תאריך</Text>

            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={onDateChange}
            />

            <View style={styles.iosButtonsRow}>
              <Pressable
                style={[styles.dateModalButton, styles.iosHalfButton, styles.cancelLightButton]}
                onPress={closeDatePicker}
              >
                <Text style={styles.cancelLightButtonText}>ביטול</Text>
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
      )}
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
  loaderScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_BG,
  },
  loaderText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 15,
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
    alignSelf: 'center',
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
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
    width: '100%',
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
    opacity: 0.85,
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
  dateArrowText: {
    fontSize: 22,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    width: 24,
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
  emptyStateSymbol: {
    fontSize: 28,
    color: '#64748B',
    fontWeight: '700',
    lineHeight: 30,
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
    paddingVertical: 6,
  },
  cardHeaderLeft: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  arrowText: {
    fontSize: 22,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    width: 24,
  },
  arrowUp: {
    transform: [{ rotate: '0deg' }],
  },
  arrowDown: {
    transform: [{ rotate: '180deg' }],
  },
  cardTitle: {
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'right',
  },
  setCard: {
    backgroundColor: '#FFFFFF',
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
    justifyContent: 'space-between',
    gap: 10,
  },
  setInputsRowMobile: {
    flexDirection: 'column',
  },
  setInputsRowWide: {
    flexDirection: 'row-reverse',
    flexWrap: 'nowrap',
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
    gap: 10,
    marginTop: 12,
  },
  actionsRowDesktop: {
    flexDirection: 'row-reverse',
  },
  actionsColumn: {
    flexDirection: 'column',
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  fullWidthButton: {
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
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  datePickerInlineWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: APP_BG,
  },
  iosPickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
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
  cancelLightButton: {
    backgroundColor: '#E2E8F0',
  },
  cancelLightButtonText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 15,
  },
});