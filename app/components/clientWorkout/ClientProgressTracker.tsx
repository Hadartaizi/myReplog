import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../database/firebase";
import { ClientItem, ExerciseItem, WorkoutItem } from "./types";
import {
  buildClientSummary,
  formatDateIL,
  getExerciseName,
  getNumericValue,
  getWorkoutDisplayDate,
  getWorkoutSortTime,
  getWorkoutTitle,
  groupExercisesByWorkout,
  hasMeaningfulExerciseData,
  hasMeaningfulWorkoutData,
} from "./clientProgressUtils";

function ArrowDownIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ArrowUpIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M18 15l-6-6-6 6"
        stroke={color}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UsersIcon({ size = 18, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="9" cy="9" r="3" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="16.5" cy="10" r="2.5" stroke={color} strokeWidth={2} fill="none" />
      <Path
        d="M3.5 18a5.5 5.5 0 0111 0"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M14 18a4 4 0 014-3.5A4 4 0 0122 18"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function WorkoutIcon({ size = 18, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="10" width="4" height="4" rx="1" fill={color} />
      <Rect x="17" y="10" width="4" height="4" rx="1" fill={color} />
      <Line x1="7" y1="12" x2="17" y2="12" stroke={color} strokeWidth={2.4} />
      <Line x1="3" y1="8" x2="3" y2="16" stroke={color} strokeWidth={2.4} />
      <Line x1="21" y1="8" x2="21" y2="16" stroke={color} strokeWidth={2.4} />
    </Svg>
  );
}

type Props = {
  clients?: ClientItem[];
};

export default function ClientProgressTracker({ clients: initialClients = [] }: Props) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  const dynamic = useMemo(() => {
    return {
      titleSize: isSmallScreen ? 18 : isTablet ? 22 : 20,
      textSize: isSmallScreen ? 13 : 14,
      subTextSize: isSmallScreen ? 12 : 13,
      pillHeight: isSmallScreen ? 46 : 50,
      cardPadding: isSmallScreen ? 14 : 16,
    };
  }, [isSmallScreen, isTablet]);

  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [loadingClients, setLoadingClients] = useState(initialClients.length === 0);
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(
    initialClients[0] || null
  );
  const [loadingData, setLoadingData] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [openWorkoutIds, setOpenWorkoutIds] = useState<Record<string, boolean>>({});

  const loadClients = useCallback(async () => {
    if (initialClients.length > 0) {
      setClients(initialClients);
      setSelectedClient((prev) => prev || initialClients[0] || null);
      setLoadingClients(false);
      return;
    }

    try {
      setLoadingClients(true);
      const q = query(collection(db, "users"), where("role", "==", "client"));
      const snap = await getDocs(q);

      const list: ClientItem[] = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientItem, "id">),
        }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));

      setClients(list);
      setSelectedClient((prev) => prev || list[0] || null);
    } catch (error) {
      console.error("שגיאה בטעינת לקוחות:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את רשימת הלקוחות");
    } finally {
      setLoadingClients(false);
    }
  }, [initialClients]);

  const loadClientData = useCallback(async (client: ClientItem | null) => {
    if (!client) {
      setWorkouts([]);
      setExercises([]);
      return;
    }

    const targetUid = client.uid || client.id;

    try {
      setLoadingData(true);

      const workoutsQuery = query(collection(db, "workouts"), where("uid", "==", targetUid));
      const exercisesQuery = query(collection(db, "exercises"), where("uid", "==", targetUid));

      const [workoutsSnap, exercisesSnap] = await Promise.all([
        getDocs(workoutsQuery),
        getDocs(exercisesQuery),
      ]);

      const workoutsList: WorkoutItem[] = workoutsSnap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<WorkoutItem, "id">),
        }))
        .sort((a, b) => getWorkoutSortTime(b) - getWorkoutSortTime(a));

      const exercisesList: ExerciseItem[] = exercisesSnap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ExerciseItem, "id">),
        }))
        .filter((exercise) => hasMeaningfulExerciseData(exercise));

      setWorkouts(workoutsList);
      setExercises(exercisesList);
    } catch (error) {
      console.error("שגיאה בטעינת נתוני לקוח:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את נתוני הלקוח");
      setWorkouts([]);
      setExercises([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    loadClientData(selectedClient);
  }, [selectedClient, loadClientData]);

  const exercisesByWorkout = useMemo(
    () => groupExercisesByWorkout(workouts, exercises),
    [workouts, exercises]
  );

  const visibleWorkouts = useMemo(() => {
    return workouts.filter((workout) =>
      hasMeaningfulWorkoutData(workout, exercisesByWorkout[workout.id] || [])
    );
  }, [workouts, exercisesByWorkout]);

  const visibleExercises = useMemo(() => {
    const validWorkoutIds = new Set(visibleWorkouts.map((workout) => workout.id));
    return exercises.filter(
      (exercise) =>
        !!exercise.workoutId &&
        validWorkoutIds.has(exercise.workoutId)
    );
  }, [exercises, visibleWorkouts]);

  const visibleExercisesByWorkout = useMemo(
    () => groupExercisesByWorkout(visibleWorkouts, visibleExercises),
    [visibleWorkouts, visibleExercises]
  );

  const summary = useMemo(
    () => buildClientSummary(visibleWorkouts, visibleExercises),
    [visibleWorkouts, visibleExercises]
  );

  const exerciseVolumeMap = useMemo(() => {
    const map: Record<string, { count: number; totalWeight: number }> = {};

    visibleExercises.forEach((exercise) => {
      const name = getExerciseName(exercise);
      const weight = getNumericValue(exercise.weight) || 0;

      if (!map[name]) {
        map[name] = { count: 0, totalWeight: 0 };
      }

      map[name].count += 1;
      map[name].totalWeight += weight;
    });

    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [visibleExercises]);

  useEffect(() => {
    if (visibleWorkouts.length > 0) {
      setOpenWorkoutIds({ [visibleWorkouts[0].id]: true });
    } else {
      setOpenWorkoutIds({});
    }
  }, [visibleWorkouts]);

  const toggleWorkout = (workoutId: string) => {
    setOpenWorkoutIds((prev) => ({
      ...prev,
      [workoutId]: !prev[workoutId],
    }));
  };

  if (loadingClients) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#0F172A" />
        <Text style={styles.loadingText}>טוען רשימת לקוחות...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <UsersIcon size={18} color="#0F172A" />
          <Text style={[styles.headerTitle, { fontSize: dynamic.titleSize }]}>
            מעקב לקוח
          </Text>
        </View>

        <Text style={[styles.headerSubtitle, { fontSize: dynamic.subTextSize }]}>
          בחירת לקוח, צפייה בהזנות ובמעקב התקדמות במקום אחד
        </Text>
      </View>

      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>אין לקוחות להצגה</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.clientsScrollContent}
          >
            {clients.map((client) => {
              const isSelected =
                (selectedClient?.uid || selectedClient?.id) === (client.uid || client.id);

              return (
                <Pressable
                  key={client.id}
                  onPress={() => setSelectedClient(client)}
                  style={({ pressed }) => [
                    styles.clientPill,
                    { minHeight: dynamic.pillHeight },
                    isSelected && styles.clientPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.clientPillName,
                      { fontSize: dynamic.textSize },
                      isSelected && styles.clientPillNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {client.name || "ללא שם"}
                  </Text>

                  <Text
                    style={[
                      styles.clientPillEmail,
                      { fontSize: dynamic.subTextSize },
                      isSelected && styles.clientPillEmailActive,
                    ]}
                    numberOfLines={1}
                  >
                    {client.email || "ללא אימייל"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedClient && (
            <View style={styles.selectedClientCard}>
              <Text style={styles.selectedClientTitle}>
                {selectedClient.name || "ללא שם"}
              </Text>
              <Text style={styles.selectedClientEmail}>
                {selectedClient.email || "ללא אימייל"}
              </Text>
            </View>
          )}

          {loadingData ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0F172A" />
              <Text style={styles.loadingText}>טוען נתוני לקוח...</Text>
            </View>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                  <Text style={styles.summaryValue}>{summary.totalWorkouts}</Text>
                  <Text style={styles.summaryLabel}>סה״כ אימונים</Text>
                </View>

                <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                  <Text style={styles.summaryValue}>{summary.workoutsThisMonth}</Text>
                  <Text style={styles.summaryLabel}>אימונים החודש</Text>
                </View>

                <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                  <Text style={styles.summaryValue}>{summary.uniqueExercises}</Text>
                  <Text style={styles.summaryLabel}>תרגילים שונים</Text>
                </View>

                <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                  <Text style={styles.summaryValue}>{summary.latestWorkoutLabel}</Text>
                  <Text style={styles.summaryLabel}>אימון אחרון</Text>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <WorkoutIcon size={18} color="#0F172A" />
                  <Text style={styles.sectionTitle}>מבט כללי על ההתקדמות</Text>
                </View>

                {exerciseVolumeMap.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>עדיין אין הזנות להצגה</Text>
                  </View>
                ) : (
                  <View style={styles.progressList}>
                    {exerciseVolumeMap.map(([name, data]) => (
                      <View key={name} style={styles.progressRow}>
                        <View style={styles.progressRowTextBox}>
                          <Text style={styles.progressName}>{name}</Text>
                          <Text style={styles.progressSubText}>
                            בוצע {data.count} פעמים
                            {data.totalWeight > 0 ? ` • סך משקל מדווח ${data.totalWeight}` : ""}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <WorkoutIcon size={18} color="#0F172A" />
                  <Text style={styles.sectionTitle}>הזנות לפי אימון</Text>
                </View>

                {visibleWorkouts.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>אין אימונים להצגה</Text>
                  </View>
                ) : (
                  visibleWorkouts.map((workout) => {
                    const workoutExercises = visibleExercisesByWorkout[workout.id] || [];
                    const isOpen = !!openWorkoutIds[workout.id];

                    return (
                      <View key={workout.id} style={styles.workoutCard}>
                        <Pressable
                          onPress={() => toggleWorkout(workout.id)}
                          style={({ pressed }) => [
                            styles.workoutHeaderButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.workoutHeaderRow}>
                            <View style={styles.workoutHeaderArrow}>
                              {isOpen ? (
                                <ArrowUpIcon size={20} color="#1E293B" />
                              ) : (
                                <ArrowDownIcon size={20} color="#1E293B" />
                              )}
                            </View>

                            <View style={styles.workoutHeaderTextBox}>
                              <Text style={styles.workoutTitle}>
                                {getWorkoutTitle(workout)}
                              </Text>
                              <Text style={styles.workoutMeta}>
                                {getWorkoutDisplayDate(workout)} • {workoutExercises.length} תרגילים
                              </Text>
                            </View>
                          </View>
                        </Pressable>

                        {isOpen && (
                          <View style={styles.workoutBody}>
                            {workout.note || workout.notes ? (
                              <View style={styles.noteBox}>
                                <Text style={styles.noteTitle}>הערות</Text>
                                <Text style={styles.noteText}>
                                  {workout.note || workout.notes}
                                </Text>
                              </View>
                            ) : null}

                            {workoutExercises.length === 0 ? (
                              <View style={styles.emptyInnerBox}>
                                <Text style={styles.emptyText}>לא נמצאו תרגילים לאימון הזה</Text>
                              </View>
                            ) : (
                              workoutExercises.map((exercise) => (
                                <View key={exercise.id} style={styles.exerciseRow}>
                                  <Text style={styles.exerciseName}>
                                    {getExerciseName(exercise)}
                                  </Text>

                                  <View style={styles.exerciseMetaRow}>
                                    {getNumericValue(exercise.sets) !== null && (
                                      <Text style={styles.exerciseMetaText}>
                                        סטים: {getNumericValue(exercise.sets)}
                                      </Text>
                                    )}

                                    {getNumericValue(exercise.reps) !== null && (
                                      <Text style={styles.exerciseMetaText}>
                                        חזרות: {getNumericValue(exercise.reps)}
                                      </Text>
                                    )}

                                    {getNumericValue(exercise.weight) !== null && (
                                      <Text style={styles.exerciseMetaText}>
                                        משקל: {getNumericValue(exercise.weight)}
                                      </Text>
                                    )}

                                    {getNumericValue(exercise.sets) === null &&
                                      getNumericValue(exercise.reps) === null &&
                                      getNumericValue(exercise.weight) === null && (
                                        <Text style={styles.exerciseMetaText}>
                                          אין פירוט נוסף
                                        </Text>
                                      )}
                                  </View>

                                  <Text style={styles.exerciseDate}>
                                    {formatDateIL(exercise.date || exercise.createdAt)}
                                  </Text>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },

  topHeader: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },

  headerTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  headerTitle: {
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "center",
  },

  headerSubtitle: {
    marginTop: 8,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },

  clientsScrollContent: {
    gap: 10,
    paddingVertical: 2,
  },

  clientPill: {
    minWidth: 150,
    maxWidth: 220,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },

  clientPillActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },

  clientPillName: {
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "right",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  clientPillNameActive: {
    color: "#1E293B",
  },

  clientPillEmail: {
    marginTop: 4,
    color: "#64748B",
    textAlign: "right",
  },

  clientPillEmailActive: {
    color: "#475569",
  },

  selectedClientCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    alignItems: "flex-end",
  },

  selectedClientTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },

  selectedClientEmail: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 13,
    textAlign: "right",
  },

  summaryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },

  summaryCard: {
    width: "48.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 95,
  },

  summaryValue: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  summaryLabel: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
  },

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    alignSelf: "stretch",
    gap: 8,
  },

  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },

  progressList: {
    gap: 10,
  },

  progressRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },

  progressRowTextBox: {
    alignItems: "flex-end",
  },

  progressName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },

  progressSubText: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 4,
    textAlign: "right",
  },

  workoutCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },

  workoutHeaderButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  workoutHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  workoutHeaderArrow: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  workoutHeaderTextBox: {
    flex: 1,
    alignItems: "flex-end",
  },

  workoutTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },

  workoutMeta: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
    textAlign: "right",
  },

  workoutBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },

  noteBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    alignItems: "flex-end",
  },

  noteTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },

  noteText: {
    marginTop: 6,
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },

  exerciseRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    alignItems: "flex-end",
  },

  exerciseName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },

  exerciseMetaRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    justifyContent: "flex-end",
  },

  exerciseMetaText: {
    color: "#334155",
    fontSize: 12,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },

  exerciseDate: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 12,
    textAlign: "right",
  },

  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
  },

  emptyInnerBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },

  emptyText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },

  loadingBox: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.8,
  },
});