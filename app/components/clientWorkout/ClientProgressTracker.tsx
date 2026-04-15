import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../database/firebase";
import type { UserRole } from "../../types/user";

type ClientItem = {
  id: string;
  uid?: string;
  authUid?: string | null;
  name?: string;
  email?: string;
  role?: UserRole;
  createdByUid?: string | null;
  showInTracker?: boolean;
};

type WorkoutItem = {
  id: string;
  uid?: string;
  title?: string;
  name?: string;
  date?: string | any;
  dateKey?: string;
  createdAt?: any;
  updatedAt?: any;
  note?: string;
  notes?: string;
  exercises?: any[];
  exerciseName?: string;
  numSets?: number | string;
  repsPerSet?: Record<
    string,
    { reps?: string | number; weight?: string | number }
  >;
  [key: string]: any;
};

type ExerciseItem = {
  id: string;
  uid?: string;
  workoutId?: string;
  exerciseName?: string;
  name?: string;
  sets?: number | string;
  reps?: number | string;
  weight?: number | string;
  date?: string | any;
  createdAt?: any;
  updatedAt?: any;
  sourceType?: "exercise_doc" | "embedded_exercise" | "legacy_workout";
  [key: string]: any;
};

type Props = {
  clients?: ClientItem[];
};

type DayGroup = {
  dayKey: string;
  displayDate: string;
  sortTime: number;
  workouts: WorkoutItem[];
  exercises: ExerciseItem[];
  notes: string[];
  latestCreatedAt: any;
};

type GroupedExercise = {
  key: string;
  name: string;
  rows: ExerciseItem[];
  latestCreatedAt: any;
};

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
      <Circle
        cx="16.5"
        cy="10"
        r="2.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
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

function SearchIcon({ size = 18, color = "#64748B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth={2} fill="none" />
      <Line
        x1="16"
        y1="16"
        x2="21"
        y2="21"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function StarIcon({ size = 16, color = "#FFFFFF" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.8l2.3 4.67 5.15.75-3.72 3.63.88 5.13L12 15.54 7.39 18l.88-5.13L4.55 9.22l5.15-.75L12 3.8z"
        fill={color}
      />
    </Svg>
  );
}

function getDateFromAny(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value?.toDate && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  if (typeof value === "object" && typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function formatDateIL(value: any): string {
  const date = getDateFromAny(value);
  if (!date) return "אין תאריך";

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTimeIL(value: any): string {
  const date = getDateFromAny(value);
  if (!date) return "אין תאריך";

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function getExerciseName(exercise: ExerciseItem | WorkoutItem): string {
  const raw = String(
    exercise.exerciseName || exercise.name || exercise.title || ""
  ).trim();

  return raw || "תרגיל ללא שם";
}

function hasSetLikeData(exercise: Partial<ExerciseItem>): boolean {
  return (
    getNumericValue(exercise.sets) !== null ||
    getNumericValue(exercise.reps) !== null ||
    getNumericValue(exercise.weight) !== null
  );
}

function hasMeaningfulExerciseData(exercise: Partial<ExerciseItem>): boolean {
  const hasName = !!String(exercise.exerciseName || exercise.name || "").trim();
  return hasName || hasSetLikeData(exercise);
}

function getWorkoutSortTime(workout: WorkoutItem): number {
  const date =
    getDateFromAny(workout.date) ||
    getDateFromAny(workout.createdAt) ||
    getDateFromAny(workout.updatedAt);

  return date ? date.getTime() : 0;
}

function getWorkoutBaseDate(workout: WorkoutItem): Date | null {
  return (
    getDateFromAny(workout.date) ||
    getDateFromAny(workout.createdAt) ||
    getDateFromAny(workout.updatedAt)
  );
}

function getExerciseBaseDate(exercise: ExerciseItem): Date | null {
  return (
    getDateFromAny(exercise.date) ||
    getDateFromAny(exercise.createdAt) ||
    getDateFromAny(exercise.updatedAt)
  );
}

function getDayKeyFromDate(date: Date | null): string {
  if (!date) return "unknown";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLatestTimeFromItems(values: any[]): number {
  return values.reduce((max, value) => {
    const time = getDateFromAny(value)?.getTime() || 0;
    return Math.max(max, time);
  }, 0);
}

function normalizeText(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeRepsPerSetToRows(params: {
  baseId: string;
  uid?: string;
  workoutId?: string;
  exerciseName?: string;
  date?: any;
  createdAt?: any;
  updatedAt?: any;
  repsPerSet?: Record<
    string,
    { reps?: string | number; weight?: string | number }
  >;
  numSets?: number | string;
  sourceType: "embedded_exercise" | "legacy_workout";
}): ExerciseItem[] {
  const {
    baseId,
    uid,
    workoutId,
    exerciseName,
    date,
    createdAt,
    updatedAt,
    repsPerSet,
    numSets,
    sourceType,
  } = params;

  const name = String(exerciseName || "").trim() || "תרגיל ללא שם";
  const map = repsPerSet || {};
  const keys = Object.keys(map)
    .filter((key) => map[key] !== undefined && map[key] !== null)
    .sort((a, b) => Number(a) - Number(b));

  if (keys.length > 0) {
    return keys.map((setKey, idx) => {
      const setData = map[setKey] || {};
      return {
        id: `${baseId}-set-${idx}`,
        uid,
        workoutId,
        exerciseName: name,
        name,
        sets: Number(setKey) + 1,
        reps: setData?.reps ?? "",
        weight: setData?.weight ?? "",
        date,
        createdAt,
        updatedAt,
        sourceType,
      };
    });
  }

  const totalSets = getNumericValue(numSets) || 0;

  if (totalSets > 0) {
    return Array.from({ length: totalSets }).map((_, idx) => ({
      id: `${baseId}-set-${idx}`,
      uid,
      workoutId,
      exerciseName: name,
      name,
      sets: idx + 1,
      reps: "",
      weight: "",
      date,
      createdAt,
      updatedAt,
      sourceType,
    }));
  }

  return [];
}

function normalizeEmbeddedExercises(workout: WorkoutItem): ExerciseItem[] {
  if (!Array.isArray(workout.exercises)) return [];

  return workout.exercises.flatMap((exercise: any, index: number) => {
    const normalizedFromMap = normalizeRepsPerSetToRows({
      baseId: `${workout.id}-embedded-${index}`,
      uid: workout.uid,
      workoutId: workout.id,
      exerciseName: exercise?.exerciseName || exercise?.name,
      date: exercise?.date || workout.date,
      createdAt: exercise?.createdAt || workout.createdAt,
      updatedAt: exercise?.updatedAt || workout.updatedAt,
      repsPerSet: exercise?.repsPerSet,
      numSets: exercise?.numSets,
      sourceType: "embedded_exercise",
    });

    if (normalizedFromMap.length > 0) {
      return normalizedFromMap;
    }

    const singleRow: ExerciseItem = {
      id: `${workout.id}-embedded-${index}`,
      uid: workout.uid,
      workoutId: workout.id,
      name: exercise?.exerciseName || exercise?.name,
      exerciseName: exercise?.exerciseName || exercise?.name,
      sets: exercise?.sets,
      reps: exercise?.reps,
      weight: exercise?.weight,
      date: exercise?.date || workout.date,
      createdAt: exercise?.createdAt || workout.createdAt,
      updatedAt: exercise?.updatedAt || workout.updatedAt,
      sourceType: "embedded_exercise",
      ...exercise,
    };

    return hasMeaningfulExerciseData(singleRow) ? [singleRow] : [];
  });
}

function normalizeLegacyWorkoutToExercises(workout: WorkoutItem): ExerciseItem[] {
  const hasLegacyMap =
    !!workout.exerciseName ||
    !!workout.repsPerSet ||
    getNumericValue(workout.numSets) !== null;

  if (!hasLegacyMap) return [];

  const rows = normalizeRepsPerSetToRows({
    baseId: `${workout.id}-legacy`,
    uid: workout.uid,
    workoutId: workout.id,
    exerciseName: workout.exerciseName || workout.title || workout.name,
    date: workout.date,
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
    repsPerSet: workout.repsPerSet,
    numSets: workout.numSets,
    sourceType: "legacy_workout",
  });

  if (rows.length > 0) {
    return rows;
  }

  const fallback: ExerciseItem = {
    id: `${workout.id}-legacy-fallback`,
    uid: workout.uid,
    workoutId: workout.id,
    exerciseName: workout.exerciseName || workout.title || workout.name,
    name: workout.exerciseName || workout.title || workout.name,
    sets: workout.numSets || "",
    reps: "",
    weight: "",
    date: workout.date,
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
    sourceType: "legacy_workout",
  };

  return hasMeaningfulExerciseData(fallback) ? [fallback] : [];
}

function mergeExercises(
  workouts: WorkoutItem[],
  exercisesFromCollection: ExerciseItem[]
): ExerciseItem[] {
  const workoutIdsWithExerciseDocs = new Set(
    exercisesFromCollection
      .map((exercise) => exercise.workoutId)
      .filter(Boolean) as string[]
  );

  const workoutIdsWithEmbeddedExercises = new Set(
    workouts
      .filter(
        (workout) => Array.isArray(workout.exercises) && workout.exercises.length > 0
      )
      .map((workout) => workout.id)
  );

  const embeddedExercises = workouts
    .filter((workout) => !workoutIdsWithExerciseDocs.has(workout.id))
    .flatMap((workout) => normalizeEmbeddedExercises(workout));

  const legacyWorkoutExercises = workouts
    .filter(
      (workout) =>
        !workoutIdsWithExerciseDocs.has(workout.id) &&
        !workoutIdsWithEmbeddedExercises.has(workout.id)
    )
    .flatMap((workout) => normalizeLegacyWorkoutToExercises(workout));

  const all = [...exercisesFromCollection, ...embeddedExercises, ...legacyWorkoutExercises];
  const seen = new Set<string>();

  return all.filter((exercise, index) => {
    const fallbackKey = [
      exercise.id || "no-id",
      exercise.workoutId || "no-workout",
      getExerciseName(exercise),
      getNumericValue(exercise.sets) ?? "no-sets",
      getNumericValue(exercise.reps) ?? "no-reps",
      getNumericValue(exercise.weight) ?? "no-weight",
      getDayKeyFromDate(getExerciseBaseDate(exercise)),
      exercise.sourceType || "unknown",
      index,
    ].join("|");

    const key = exercise.id || fallbackKey;

    if (seen.has(key)) return false;
    seen.add(key);

    return hasMeaningfulExerciseData(exercise);
  });
}

function groupExercisesByWorkout(
  workouts: WorkoutItem[],
  exercises: ExerciseItem[]
): Record<string, ExerciseItem[]> {
  const grouped: Record<string, ExerciseItem[]> = {};

  workouts.forEach((workout) => {
    grouped[workout.id] = exercises
      .filter((exercise) => exercise.workoutId === workout.id)
      .sort((a, b) => {
        const aTime =
          getDateFromAny(a.createdAt)?.getTime() ||
          getDateFromAny(a.updatedAt)?.getTime() ||
          getDateFromAny(a.date)?.getTime() ||
          0;

        const bTime =
          getDateFromAny(b.createdAt)?.getTime() ||
          getDateFromAny(b.updatedAt)?.getTime() ||
          getDateFromAny(b.date)?.getTime() ||
          0;

        return aTime - bTime;
      });
  });

  return grouped;
}

function buildDayGroups(workouts: WorkoutItem[], exercises: ExerciseItem[]): DayGroup[] {
  const map: Record<string, DayGroup> = {};
  const exercisesByWorkout = groupExercisesByWorkout(workouts, exercises);

  const ensureGroup = (date: Date | null): DayGroup => {
    const dayKey = getDayKeyFromDate(date);

    if (!map[dayKey]) {
      map[dayKey] = {
        dayKey,
        displayDate: formatDateIL(date),
        sortTime: date?.getTime() || 0,
        workouts: [],
        exercises: [],
        notes: [],
        latestCreatedAt: date || null,
      };
    }

    return map[dayKey];
  };

  workouts.forEach((workout) => {
    const workoutDate = getWorkoutBaseDate(workout);
    const group = ensureGroup(workoutDate);
    const workoutExercises = exercisesByWorkout[workout.id] || [];

    group.workouts.push(workout);
    group.exercises.push(...workoutExercises);

    const noteText = String(workout.note || workout.notes || "").trim();
    if (noteText) {
      group.notes.push(noteText);
    }

    group.sortTime = Math.max(group.sortTime, workoutDate?.getTime() || 0);

    const latestWorkoutTime = getLatestTimeFromItems([
      workout.createdAt,
      workout.updatedAt,
      workout.date,
      ...workoutExercises.flatMap((exercise) => [
        exercise.createdAt,
        exercise.updatedAt,
        exercise.date,
      ]),
    ]);

    const currentLatest = getDateFromAny(group.latestCreatedAt)?.getTime() || 0;
    if (latestWorkoutTime > currentLatest) {
      group.latestCreatedAt = workout.createdAt || workout.updatedAt || workout.date;
    }
  });

  exercises
    .filter((exercise) => !exercise.workoutId)
    .forEach((exercise) => {
      const exerciseDate = getExerciseBaseDate(exercise);
      const group = ensureGroup(exerciseDate);

      group.exercises.push(exercise);
      group.sortTime = Math.max(group.sortTime, exerciseDate?.getTime() || 0);

      const exerciseLatest = getLatestTimeFromItems([
        exercise.createdAt,
        exercise.updatedAt,
        exercise.date,
      ]);

      const currentLatest = getDateFromAny(group.latestCreatedAt)?.getTime() || 0;
      if (exerciseLatest > currentLatest) {
        group.latestCreatedAt = exercise.createdAt || exercise.updatedAt || exercise.date;
      }
    });

  return Object.values(map)
    .map((group) => {
      const seenExerciseKeys = new Set<string>();

      const dedupedExercises = group.exercises.filter((exercise, index) => {
        const key = [
          exercise.id || "no-id",
          exercise.workoutId || "no-workout",
          getExerciseName(exercise),
          getNumericValue(exercise.sets) ?? "no-sets",
          getNumericValue(exercise.reps) ?? "no-reps",
          getNumericValue(exercise.weight) ?? "no-weight",
          getDayKeyFromDate(getExerciseBaseDate(exercise)),
          exercise.sourceType || "unknown",
          index,
        ].join("|");

        if (seenExerciseKeys.has(key)) return false;
        seenExerciseKeys.add(key);
        return true;
      });

      return {
        ...group,
        notes: Array.from(new Set(group.notes)),
        exercises: dedupedExercises.sort((a, b) => {
          const aTime =
            getDateFromAny(a.createdAt)?.getTime() ||
            getDateFromAny(a.updatedAt)?.getTime() ||
            getDateFromAny(a.date)?.getTime() ||
            0;

          const bTime =
            getDateFromAny(b.createdAt)?.getTime() ||
            getDateFromAny(b.updatedAt)?.getTime() ||
            getDateFromAny(b.date)?.getTime() ||
            0;

          return aTime - bTime;
        }),
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);
}

function groupExercisesInsideDay(
  exercises: ExerciseItem[],
  dayKey: string
): GroupedExercise[] {
  const map: Record<string, GroupedExercise> = {};

  exercises.forEach((exercise) => {
    const exerciseName = getExerciseName(exercise);
    const groupKey = `${dayKey}-${exerciseName}`;

    if (!map[groupKey]) {
      map[groupKey] = {
        key: groupKey,
        name: exerciseName,
        rows: [],
        latestCreatedAt: exercise.createdAt || exercise.updatedAt || exercise.date,
      };
    }

    map[groupKey].rows.push(exercise);

    const currentLatest = getDateFromAny(map[groupKey].latestCreatedAt)?.getTime() || 0;
    const candidateLatest =
      getLatestTimeFromItems([exercise.createdAt, exercise.updatedAt, exercise.date]) || 0;

    if (candidateLatest > currentLatest) {
      map[groupKey].latestCreatedAt =
        exercise.createdAt || exercise.updatedAt || exercise.date;
    }
  });

  const grouped = Object.values(map).map((group) => {
    const sortedRows = [...group.rows].sort((a, b) => {
      const aSet = getNumericValue(a.sets);
      const bSet = getNumericValue(b.sets);

      if (aSet !== null && bSet !== null && aSet !== bSet) {
        return aSet - bSet;
      }

      const aTime =
        getDateFromAny(a.createdAt)?.getTime() ||
        getDateFromAny(a.updatedAt)?.getTime() ||
        getDateFromAny(a.date)?.getTime() ||
        0;

      const bTime =
        getDateFromAny(b.createdAt)?.getTime() ||
        getDateFromAny(b.updatedAt)?.getTime() ||
        getDateFromAny(b.date)?.getTime() ||
        0;

      return aTime - bTime;
    });

    const hasRealRows = sortedRows.some((row) => hasSetLikeData(row));

    const filteredRows = hasRealRows
      ? sortedRows.filter((row) => hasSetLikeData(row))
      : sortedRows;

    return {
      ...group,
      rows: filteredRows,
    };
  });

  return grouped.sort((a, b) => a.name.localeCompare(b.name, "he"));
}

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
  const [savingTrackerFlag, setSavingTrackerFlag] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [openDayIds, setOpenDayIds] = useState<Record<string, boolean>>({});
  const [openExerciseIds, setOpenExerciseIds] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");

  const loadClients = useCallback(async () => {
    if (initialClients.length > 0) {
      const normalizedInitial = [...initialClients].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "he")
      );

      setClients(normalizedInitial);
      setSelectedClient((prev) => {
        if (prev) {
          const freshSelected =
            normalizedInitial.find((c) => c.id === prev.id) || prev;
          return freshSelected;
        }
        return normalizedInitial[0] || null;
      });
      setLoadingClients(false);
      return;
    }

    try {
      setLoadingClients(true);

      const me = auth.currentUser;
      if (!me?.uid) {
        setClients([]);
        setSelectedClient(null);
        setLoadingClients(false);
        return;
      }

      const myUserSnap = await getDoc(doc(db, "users", me.uid));
      const myUser = myUserSnap.data();

      let q;

      if (myUser?.role === "owner") {
        q = query(collection(db, "users"), where("role", "==", "client"));
      } else if (myUser?.role === "admin") {
        q = query(
          collection(db, "users"),
          where("role", "==", "client"),
          where("createdByUid", "==", me.uid)
        );
      } else {
        setClients([]);
        setSelectedClient(null);
        setLoadingClients(false);
        return;
      }

      const snap = await getDocs(q);

      const list: ClientItem[] = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientItem, "id">),
        }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));

      setClients(list);
      setSelectedClient((prev) => {
        if (prev) {
          const freshSelected = list.find((c) => c.id === prev.id) || prev;
          return freshSelected;
        }
        return list.find((c) => !!c.showInTracker) || list[0] || null;
      });
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

    if (!client.showInTracker) {
      setWorkouts([]);
      setExercises([]);
      setLoadingData(false);
      return;
    }

    const targetUid = client.authUid || client.uid || client.id;

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

      const exercisesFromCollection: ExerciseItem[] = exercisesSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ExerciseItem, "id">),
        sourceType: "exercise_doc",
      }));

      const mergedExercises = mergeExercises(workoutsList, exercisesFromCollection);

      setWorkouts(workoutsList);
      setExercises(mergedExercises);
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

  const trackedClients = useMemo(
    () => clients.filter((client) => !!client.showInTracker),
    [clients]
  );

  const visibleClients = useMemo(() => {
    const term = normalizeText(searchText);

    if (!term) {
      return trackedClients;
    }

    return clients.filter((client) => {
      const name = normalizeText(client.name || "");
      return name.startsWith(term);
    });
  }, [clients, trackedClients, searchText]);

  const dayGroups = useMemo(() => buildDayGroups(workouts, exercises), [workouts, exercises]);

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const workoutsThisMonth = dayGroups.filter((group) => {
      const d = new Date(group.sortTime);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const latestWorkout = dayGroups[0];

    const uniqueExerciseNames = new Set(
      exercises.map((exercise) => getExerciseName(exercise)).filter(Boolean)
    );

    return {
      totalWorkouts: dayGroups.length,
      totalExercises: exercises.length,
      uniqueExercises: uniqueExerciseNames.size,
      workoutsThisMonth,
      latestWorkoutLabel: latestWorkout ? latestWorkout.displayDate : "אין נתונים",
    };
  }, [dayGroups, exercises]);

  useEffect(() => {
    if (dayGroups.length > 0) {
      setOpenDayIds({ [dayGroups[0].dayKey]: true });
    } else {
      setOpenDayIds({});
    }
    setOpenExerciseIds({});
  }, [dayGroups]);

  const toggleDay = (dayKey: string) => {
    setOpenDayIds((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }));
  };

  const toggleExercise = (exerciseKey: string) => {
    setOpenExerciseIds((prev) => ({
      ...prev,
      [exerciseKey]: !prev[exerciseKey],
    }));
  };

  const toggleClientTrackerFlag = useCallback(async () => {
    if (!selectedClient) return;

    const nextValue = !selectedClient.showInTracker;

    try {
      setSavingTrackerFlag(true);

      await updateDoc(doc(db, "users", selectedClient.id), {
        showInTracker: nextValue,
        updatedAt: new Date().toISOString(),
      });

      setClients((prev) =>
        prev.map((client) =>
          client.id === selectedClient.id
            ? { ...client, showInTracker: nextValue }
            : client
        )
      );

      setSelectedClient((prev) =>
        prev ? { ...prev, showInTracker: nextValue } : prev
      );

      if (!nextValue) {
        setWorkouts([]);
        setExercises([]);
      }

      Alert.alert(
        "עודכן בהצלחה",
        nextValue
          ? "הלקוח נוסף למעקב וכל האימונים שלו יוצגו."
          : "הלקוח הוסר מהמעקב והאימונים שלו לא יוצגו עד שתפעילי שוב."
      );
    } catch (error) {
      console.error("שגיאה בעדכון מעקב לקוח:", error);
      Alert.alert("שגיאה", "לא ניתן לעדכן את הגדרת המעקב עבור הלקוח");
    } finally {
      setSavingTrackerFlag(false);
    }
  }, [selectedClient]);

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
            מעקב לקוחות
          </Text>
        </View>

        <Text style={[styles.headerSubtitle, { fontSize: dynamic.subTextSize }]}>
          חיפוש לפי תחילת שם. בלי חיפוש יוצגו רק לקוחות שסומנו למעקב.
        </Text>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchInputWrap}>
          <SearchIcon size={18} color="#64748B" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="חפשי לפי תחילת שם הלקוח..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            textAlign="right"
          />
        </View>

        <Text style={styles.searchInfoText}>
          {searchText.trim()
            ? `נמצאו ${visibleClients.length} לקוחות לפי החיפוש`
            : `לקוחות במעקב: ${trackedClients.length}`}
        </Text>
      </View>

      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>אין לקוחות להצגה</Text>
        </View>
      ) : (
        <>
          {visibleClients.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {searchText.trim()
                  ? "לא נמצאו לקוחות שמתחילים באותיות האלו"
                  : "עדיין לא סומנו לקוחות למעקב"}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.clientsScrollContent}
            >
              {visibleClients.map((client) => {
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
                    <View style={styles.clientPillTopRow}>
                      {!!client.showInTracker && (
                        <View style={styles.trackedBadge}>
                          <StarIcon size={12} color="#FFFFFF" />
                          <Text style={styles.trackedBadgeText}>במעקב</Text>
                        </View>
                      )}
                    </View>

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
          )}

          {selectedClient && (
            <View style={styles.selectedClientCard}>
              <View style={styles.selectedClientTopRow}>
                <View style={styles.selectedClientTextWrap}>
                  <Text style={styles.selectedClientTitle}>
                    {selectedClient.name || "ללא שם"}
                  </Text>
                  <Text style={styles.selectedClientEmail}>
                    {selectedClient.email || "ללא אימייל"}
                  </Text>
                </View>

                <View style={styles.switchBlock}>
                  <Text style={styles.switchLabel}>
                    {savingTrackerFlag
                      ? "שומר..."
                      : selectedClient.showInTracker
                      ? "במעקב"
                      : "לא במעקב"}
                  </Text>

                  <Switch
                    value={!!selectedClient.showInTracker}
                    onValueChange={toggleClientTrackerFlag}
                    disabled={savingTrackerFlag}
                    trackColor={{ false: "#CBD5E1", true: "#0F172A" }}
                    thumbColor={"#FFFFFF"}
                  />
                </View>
              </View>

              <Text style={styles.selectedClientStatusText}>
                {selectedClient.showInTracker
                  ? "הלקוח מסומן למעקב וכל האימונים שלו מוצגים."
                  : "הלקוח לא מסומן למעקב כרגע."}
              </Text>
            </View>
          )}

          {selectedClient && !selectedClient.showInTracker ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                הלקוח הזה לא מסומן למעקב. לחצי על "הוסף למעקב" כדי להציג את כל האימונים שלו.
              </Text>
            </View>
          ) : loadingData ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0F172A" />
              <Text style={styles.loadingText}>טוען נתוני לקוח...</Text>
            </View>
          ) : (
            selectedClient && (
              <>
                <View style={styles.summaryGrid}>
                  <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                    <Text style={styles.summaryValue}>{summary.totalWorkouts}</Text>
                    <Text style={styles.summaryLabel}>סה״כ אימונים</Text>
                  </View>

                  <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                    <Text style={styles.summaryValue}>{summary.totalExercises}</Text>
                    <Text style={styles.summaryLabel}>סה״כ תרגילים</Text>
                  </View>

                  <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                    <Text style={styles.summaryValue}>{summary.workoutsThisMonth}</Text>
                    <Text style={styles.summaryLabel}>אימונים החודש</Text>
                  </View>

                  <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}>
                    <Text style={styles.summaryValue}>{summary.latestWorkoutLabel}</Text>
                    <Text style={styles.summaryLabel}>אימון אחרון</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <WorkoutIcon size={18} color="#0F172A" />
                    <Text style={styles.sectionTitle}>כל האימונים וההזנות</Text>
                  </View>

                  {dayGroups.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>אין אימונים להצגה</Text>
                    </View>
                  ) : (
                    dayGroups.map((group) => {
                      const isOpen = !!openDayIds[group.dayKey];
                      const groupedExercises = groupExercisesInsideDay(
                        group.exercises,
                        group.dayKey
                      );

                      return (
                        <View key={group.dayKey} style={styles.workoutCard}>
                          <Pressable
                            onPress={() => toggleDay(group.dayKey)}
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
                                  אימון מתאריך {group.displayDate}
                                </Text>

                                <Text style={styles.workoutMeta}>
                                  {groupedExercises.length} תרגילים
                                </Text>

                                <Text style={styles.workoutMeta}>
                                  הוזן למערכת: {formatDateTimeIL(group.latestCreatedAt)}
                                </Text>
                              </View>
                            </View>
                          </Pressable>

                          {isOpen && (
                            <View style={styles.workoutBody}>
                              {group.notes.length > 0 && (
                                <View style={styles.noteBox}>
                                  <Text style={styles.noteTitle}>הערות לאימון</Text>
                                  {group.notes.map((note, index) => (
                                    <Text
                                      key={`${group.dayKey}-note-${index}`}
                                      style={styles.noteText}
                                    >
                                      {note}
                                    </Text>
                                  ))}
                                </View>
                              )}

                              {groupedExercises.length === 0 ? (
                                <View style={styles.emptyInnerBox}>
                                  <Text style={styles.emptyText}>
                                    לא נמצאו תרגילים לאותו יום
                                  </Text>
                                </View>
                              ) : (
                                groupedExercises.map((exerciseGroup) => {
                                  const isExerciseOpen = !!openExerciseIds[exerciseGroup.key];

                                  return (
                                    <View key={exerciseGroup.key} style={styles.exerciseCard}>
                                      <Pressable
                                        onPress={() => toggleExercise(exerciseGroup.key)}
                                        style={({ pressed }) => [
                                          styles.exerciseHeaderButton,
                                          pressed && styles.pressed,
                                        ]}
                                      >
                                        <View style={styles.exerciseHeaderRow}>
                                          <View style={styles.workoutHeaderArrow}>
                                            {isExerciseOpen ? (
                                              <ArrowUpIcon size={18} color="#1E293B" />
                                            ) : (
                                              <ArrowDownIcon size={18} color="#1E293B" />
                                            )}
                                          </View>

                                          <View style={styles.exerciseHeaderTextBox}>
                                            <Text style={styles.exerciseName}>
                                              {exerciseGroup.name}
                                            </Text>

                                            <Text style={styles.exerciseTapHint}>
                                              לחצי לצפייה בסטים, חזרות ומשקל
                                            </Text>
                                          </View>
                                        </View>
                                      </Pressable>

                                      {isExerciseOpen && (
                                        <View style={styles.exerciseDetailsBox}>
                                          {exerciseGroup.rows.map((row, rowIndex) => {
                                            const setNumber = getNumericValue(row.sets);
                                            const repsValue = getNumericValue(row.reps);
                                            const weightValue = getNumericValue(row.weight);

                                            return (
                                              <View
                                                key={
                                                  row.id ||
                                                  `${exerciseGroup.key}-row-${rowIndex}`
                                                }
                                                style={styles.setRow}
                                              >
                                                <Text style={styles.setRowText}>
                                                  {setNumber !== null
                                                    ? `סט ${setNumber}`
                                                    : `סט ${rowIndex + 1}`}
                                                </Text>

                                                <Text style={styles.setRowText}>
                                                  {repsValue !== null
                                                    ? `חזרות: ${repsValue}`
                                                    : "חזרות: לא הוזן"}
                                                </Text>

                                                <Text style={styles.setRowText}>
                                                  {weightValue !== null
                                                    ? `משקל: ${weightValue}`
                                                    : "משקל: לא הוזן"}
                                                </Text>
                                              </View>
                                            );
                                          })}

                                          <Text style={styles.exerciseDate}>
                                            תאריך תרגיל:{" "}
                                            {formatDateIL(
                                              exerciseGroup.rows[0]?.date || group.sortTime
                                            )}
                                          </Text>

                                          <Text style={styles.exerciseDate}>
                                            הוזן למערכת:{" "}
                                            {formatDateTimeIL(exerciseGroup.latestCreatedAt)}
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                  );
                                })
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )
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

  searchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },

  searchInputWrap: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },

  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
    flexDirection: "row-reverse",
  },

  searchInfoText: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "right",
  },

  clientsScrollContent: {
    gap: 10,
    paddingVertical: 2,
  },

  clientPill: {
    minWidth: 170,
    maxWidth: 230,
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

  clientPillTopRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    minHeight: 20,
  },

  trackedBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-end",
  },

  trackedBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
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
    gap: 10,
  },

  selectedClientTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  selectedClientTextWrap: {
    flex: 1,
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

  selectedClientStatusText: {
    color: "#475569",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },

  switchBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 90,
  },

  switchLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    columnGap: 10,
  },

  summaryCard: {
    width: "48%",
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
    marginBottom: 6,
  },

  noteText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    width: "100%",
    marginTop: 4,
  },

  exerciseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },

  exerciseHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  exerciseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  exerciseHeaderTextBox: {
    flex: 1,
    alignItems: "flex-end",
  },

  exerciseName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },

  exerciseTapHint: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
    textAlign: "right",
  },

  exerciseDetailsBox: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
    alignItems: "stretch",
    gap: 8,
  },

  setRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "flex-end",
    gap: 4,
  },

  setRowText: {
    color: "#334155",
    fontSize: 13,
    textAlign: "right",
  },

  exerciseDate: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
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