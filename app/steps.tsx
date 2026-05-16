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
  setDoc,
  writeBatch,
} from 'firebase/firestore';

const APP_BG = '#050505';
const CARD_BG = '#111111';
const CARD_BG_2 = '#171717';
const FIELD_BG = '#202020';
const ORANGE = '#FF6A00';
const ORANGE_LIGHT = '#FF8A00';
const TEXT_LIGHT = '#F5F5F5';
const TEXT_MUTED = '#B8B8B8';
const BORDER_DARK = '#333333';

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateOnly = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const hasOwn = (obj: any, key: string) =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);

const getExerciseNameValue = (item: any) => {
  if (!item) return '';

  if (hasOwn(item, 'exerciseName')) return String(item.exerciseName ?? '');
  if (hasOwn(item, 'name')) return String(item.name ?? '');
  if (hasOwn(item, 'title')) return String(item.title ?? '');

  return '';
};

const getExerciseDisplayName = (workout: any) => {
  const directName = getExerciseNameValue(workout).trim();
  const embeddedFirstName = Array.isArray(workout?.exercises)
    ? getExerciseNameValue(workout.exercises[0]).trim()
    : '';

  if (directName && !directName.startsWith('אימון ')) return directName;
  return embeddedFirstName || directName || 'תרגיל ללא שם';
};

const sortSetKeys = (repsPerSet: any) => {
  return Object.keys(repsPerSet || {}).sort((a, b) => Number(a) - Number(b));
};

const buildWorkoutExercisePayload = (workout: any, updatedAt: string) => {
  const repsPerSet = workout.repsPerSet || {};
  const keys = sortSetKeys(repsPerSet);
  const numSets = String(workout.numSets ?? keys.length ?? '');
  const exerciseName = getExerciseDisplayName(workout);

  const reps = keys
    .map((key) => String(repsPerSet[key]?.reps || '').trim())
    .filter(Boolean)
    .join(', ');

  const weight = keys
    .map((key) => String(repsPerSet[key]?.weight || '').trim())
    .filter(Boolean)
    .join(', ');

  return {
    numSets,
    sets: numSets,
    repsPerSet,
    reps,
    weight,
    title: exerciseName,
    name: exerciseName,
    exerciseName,
    updatedAt,
  };
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

    if (dateValue?.toDate) return dateValue.toDate();
    if (dateValue instanceof Date) return dateValue;

    if (typeof dateValue === 'string') {
      const simpleDateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (simpleDateMatch) {
        const [, year, month, day] = simpleDateMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }

      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) return parsed;
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

  const fetchWorkouts = async (dateToFilter?: Date) => {
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
            exerciseName: hasOwn(data, 'exerciseName')
              ? String(data.exerciseName ?? '')
              : Array.isArray(data.exercises) && data.exercises[0]
              ? getExerciseNameValue(data.exercises[0])
              : String(data.name || data.title || ''),
          };
        })
        .sort((a: any, b: any) => {
          const aTime = parseWorkoutDate(a.date)?.getTime() || 0;
          const bTime = parseWorkoutDate(b.date)?.getTime() || 0;
          return aTime - bTime;
        });

      setAllWorkouts(workouts);
      filterByDate(workouts, dateToFilter || selectedDate);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts(selectedDate);
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

      const updatedAt = new Date().toISOString();
      const payload = buildWorkoutExercisePayload(workout, updatedAt);
      const uid = workout.uid || auth.currentUser?.uid || '';

      await updateDoc(doc(db, 'workouts', workout.id), payload);

      const linkedExercisesSnap = await getDocs(
        query(collection(db, 'exercises'), where('workoutId', '==', workout.id))
      );

      if (!linkedExercisesSnap.empty) {
        const batch = writeBatch(db);

        linkedExercisesSnap.docs.forEach((exerciseDoc) => {
          batch.update(doc(db, 'exercises', exerciseDoc.id), {
            ...payload,
            uid,
            workoutId: workout.id,
            date: workout.date || '',
            dateKey: workout.dateKey || '',
            clientSucceeded: workout.clientSucceeded ?? null,
            clientNotes: workout.clientNotes || '',
            clientUpdatedAt: workout.clientUpdatedAt || '',
          });
        });

        await batch.commit();
      } else {
        await setDoc(
          doc(db, 'exercises', workout.id),
          {
            ...workout,
            ...payload,
            uid,
            workoutId: workout.id,
            date: workout.date || '',
            dateKey: workout.dateKey || '',
            sourceType: 'exercise_doc',
          },
          { merge: true }
        );
      }

      setEditingId(null);
      setOriginalWorkout(null);
      setErrorMessage('');

      await fetchWorkouts(selectedDate);

      if (Platform.OS === 'web') {
        window.alert('השינויים נשמרו');
      } else {
        Alert.alert('הצלחה', 'השינויים נשמרו');
      }
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('שגיאה', 'שמירת האימון נכשלה');
    } finally {
      setSavingId(null);
    }
  };

  const deleteLinkedExercises = async (workoutId: string) => {
    const linkedExercisesSnap = await getDocs(
      query(collection(db, 'exercises'), where('workoutId', '==', workoutId))
    );

    if (linkedExercisesSnap.empty) return;

    const batch = writeBatch(db);
    linkedExercisesSnap.docs.forEach((exerciseDoc) => {
      batch.delete(doc(db, 'exercises', exerciseDoc.id));
    });
    await batch.commit();
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
      await deleteLinkedExercises(workoutId);

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
            <ActivityIndicator size="large" color="#FF6A00" />
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
                        color: TEXT_LIGHT,
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
                          <Text style={[styles.cardTitle, { fontSize: dynamic.textSize + 1 }]}>
                            {getExerciseDisplayName(workout)}
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
                              placeholderTextColor="#8F8F8F"
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
                                      placeholderTextColor="#8F8F8F"
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
                                      placeholderTextColor="#8F8F8F"
                                      keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "decimal-pad"}
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
                                    <ActivityIndicator size="small" color="#050505" />
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
                                        w.id === workout.id
                                          ? JSON.parse(JSON.stringify(originalWorkout || w))
                                          : w
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
                              <ActivityIndicator size="small" color="#FF6A00" />
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
    color: TEXT_MUTED,
    fontSize: 15,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: APP_BG,
  },
  mainCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    shadowColor: ORANGE,
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
    color: TEXT_LIGHT,
    textAlign: 'center',
  },
  subtitle: {
    color: TEXT_MUTED,
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
    color: '#E8E8E8',
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },
  inputBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 16,
    backgroundColor: FIELD_BG,
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInput: {
    color: TEXT_LIGHT,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
    width: '100%',
  },
  disabledInput: {
    backgroundColor: '#262626',
    color: TEXT_MUTED,
    opacity: 0.85,
  },
  dateField: {
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 16,
    backgroundColor: FIELD_BG,
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
    color: TEXT_LIGHT,
    fontWeight: '700',
    textAlign: 'right',
  },
  dateHint: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'right',
  },
  dateArrowText: {
    fontSize: 22,
    color: ORANGE,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    width: 24,
  },
  emptyState: {
    marginTop: 8,
    backgroundColor: FIELD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateSymbol: {
    fontSize: 28,
    color: TEXT_MUTED,
    fontWeight: '700',
    lineHeight: 30,
  },
  noWorkoutText: {
    color: TEXT_MUTED,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
  },
  workoutCard: {
    backgroundColor: FIELD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER_DARK,
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
    color: ORANGE,
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
    color: TEXT_LIGHT,
    textAlign: 'right',
  },
  setCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    padding: 14,
    marginBottom: 12,
  },
  setTitle: {
    textAlign: 'right',
    fontWeight: '700',
    color: TEXT_LIGHT,
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
    color: TEXT_MUTED,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  smallInput: {
    width: '100%',
  },
  errorText: {
    color: '#FF3B30',
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
    backgroundColor: '#2A2A2A',
  },
  editButtonText: {
    color: TEXT_LIGHT,
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: ORANGE,
    borderWidth: 1,
    borderColor: ORANGE_LIGHT,
  },
  saveButtonText: {
    color: '#050505',
    fontWeight: '800',
  },
  cancelButton: {
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  cancelButtonText: {
    color: TEXT_LIGHT,
    fontWeight: '800',
  },
  deleteButton: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: '#FF3B30',
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
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 20,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_LIGHT,
    marginBottom: 12,
    textAlign: 'center',
  },
  dateModalButton: {
    marginTop: 16,
    backgroundColor: ORANGE,
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
    backgroundColor: '#2A2A2A',
  },
  cancelLightButtonText: {
    color: TEXT_LIGHT,
    fontWeight: '700',
    fontSize: 15,
  },
});