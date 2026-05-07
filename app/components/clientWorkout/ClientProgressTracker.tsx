import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  setDoc,
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
  coachFeedback?: string;
  coachFeedbackUpdatedAt?: string;
  exercises?: any[];
  exerciseName?: string;
  numSets?: number | string;
  repsPerSet?: Record<string, { reps?: string | number; weight?: string | number }>;
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
  clientSucceeded?: boolean | null;
  clientNotes?: string;
  clientUpdatedAt?: string;
  source?: string;
  programExerciseId?: string;
  programSectionTitle?: string;
  [key: string]: any;
};

type ProgramType = "strength" | "running";
type RunningPaceType = "steady" | "intervals";
type RunningManipulationType =
  | "volume"
  | "fartlek"
  | "tempo"
  | "threshold"
  | "intervals"
  | "recovery"
  | "hills";
type TrainingViewType = "strength" | "running";

type RunningWeek = {
  id: string;
  weekNumber: number;
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

type TrainingProgramDoc = {
  clientUid?: string;
  clientName?: string;
  clientEmail?: string;
  sections?: any[];
  notes?: string;
  programText?: string;
  updatedAt?: string;
  programType?: ProgramType;
  strengthCoachFeedback?: string;
  strengthCoachFeedbackUpdatedAt?: string;
  strengthProgramHistory?: any[];
  runningWeeks?: RunningWeek[];
  runningWeeksCount?: number;
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
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowUpIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UsersIcon({ size = 18, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="9" cy="9" r="3" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="16.5" cy="10" r="2.5" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M3.5 18a5.5 5.5 0 0111 0" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M14 18a4 4 0 014-3.5A4 4 0 0122 18" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
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
      <Line x1="16" y1="16" x2="21" y2="21" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function getDateFromAny(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value?.toDate && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value === "object" && typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function formatDateIL(value: any): string {
  const date = getDateFromAny(value);
  if (!date) return "אין תאריך";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatDateTimeIL(value: any): string {
  const date = getDateFromAny(value);
  if (!date) return "לא זמין";
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

function getNumberFromAny(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getExerciseName(exercise: ExerciseItem | WorkoutItem): string {
  const raw = String(exercise.exerciseName || exercise.name || exercise.title || "").trim();
  return raw || "תרגיל ללא שם";
}

function hasSetLikeData(exercise: Partial<ExerciseItem>): boolean {
  return getNumericValue(exercise.sets) !== null || getNumericValue(exercise.reps) !== null || getNumericValue(exercise.weight) !== null;
}

function hasMeaningfulExerciseData(exercise: Partial<ExerciseItem>): boolean {
  const hasName = !!String(exercise.exerciseName || exercise.name || "").trim();
  return hasName || hasSetLikeData(exercise);
}

function getWorkoutSortTime(workout: WorkoutItem): number {
  const date = getDateFromAny(workout.date) || getDateFromAny(workout.createdAt) || getDateFromAny(workout.updatedAt);
  return date ? date.getTime() : 0;
}

function getWorkoutBaseDate(workout: WorkoutItem): Date | null {
  return getDateFromAny(workout.date) || getDateFromAny(workout.createdAt) || getDateFromAny(workout.updatedAt);
}

function getExerciseBaseDate(exercise: ExerciseItem): Date | null {
  return getDateFromAny(exercise.date) || getDateFromAny(exercise.createdAt) || getDateFromAny(exercise.updatedAt);
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

function getSavedTime(exercise: Partial<ExerciseItem | WorkoutItem>): number {
  return (
    getDateFromAny(exercise.createdAt)?.getTime() ||
    getNumberFromAny((exercise as any).clientEntryOrder) ||
    getDateFromAny(exercise.updatedAt)?.getTime() ||
    getDateFromAny(exercise.date)?.getTime() ||
    0
  );
}

function getExerciseOrderValue(exercise: Partial<ExerciseItem | WorkoutItem>): number {
  return (
    getNumberFromAny((exercise as any).clientEntryOrder) ??
    getNumberFromAny((exercise as any).exerciseOrder) ??
    getNumberFromAny((exercise as any).order) ??
    getNumberFromAny((exercise as any).setOrder) ??
    0
  );
}

function compareExercisesBySaveOrder(a: Partial<ExerciseItem>, b: Partial<ExerciseItem>) {
  const aSavedTime = getSavedTime(a);
  const bSavedTime = getSavedTime(b);
  if (aSavedTime !== bSavedTime) return aSavedTime - bSavedTime;
  const aOrder = getExerciseOrderValue(a);
  const bOrder = getExerciseOrderValue(b);
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function getGroupFirstSavedRow(rows: ExerciseItem[]): ExerciseItem | null {
  if (rows.length === 0) return null;
  return [...rows].sort(compareExercisesBySaveOrder)[0] || null;
}

function compareGroupedExercisesBySaveOrder(a: GroupedExercise, b: GroupedExercise) {
  const aFirst = getGroupFirstSavedRow(a.rows);
  const bFirst = getGroupFirstSavedRow(b.rows);
  if (aFirst && bFirst) {
    const result = compareExercisesBySaveOrder(aFirst, bFirst);
    if (result !== 0) return result;
  }
  return a.name.localeCompare(b.name, "he");
}

function normalizeText(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function getClientResolvedUid(client: ClientItem | null): string {
  if (!client) return "";
  return String(client.authUid || client.uid || client.id || "").trim();
}

function getPaceTypeLabel(value?: RunningPaceType) {
  if (value === "intervals") return "קצב משתנה בין מהיר לקל";
  return "קצב קבוע";
}

function getManipulationLabel(value?: RunningManipulationType | string) {
  if (value === "volume") return "ריצת נפח";
  if (value === "fartlek") return "ריצת פארטלק";
  if (value === "tempo" || value === "quality") return "ריצת טמפו";
  if (value === "threshold") return "ריצת טראשהולד";
  if (value === "intervals") return "אינטרוולים";
  if (value === "recovery") return "ריצת התאוששות";
  if (value === "hills") return "עליות";
  return "";
}

function getSucceededLabel(value?: boolean | null) {
  if (value === true) return "הצליח/ה";
  if (value === false) return "לא הצליח/ה";
  return "לא עודכן";
}

function normalizeRepsPerSetToRows(params: {
  baseId: string;
  uid?: string;
  workoutId?: string;
  exerciseName?: string;
  date?: any;
  createdAt?: any;
  updatedAt?: any;
  repsPerSet?: Record<string, { reps?: string | number; weight?: string | number }>;
  numSets?: number | string;
  order?: number | string;
  exerciseOrder?: number | string;
  clientEntryOrder?: number | string;
  clientSucceeded?: boolean | null;
  clientNotes?: string;
  clientUpdatedAt?: string;
  source?: string;
  programExerciseId?: string;
  programSectionTitle?: string;
  sourceType: "exercise_doc" | "embedded_exercise" | "legacy_workout";
}): ExerciseItem[] {
  const { baseId, uid, workoutId, exerciseName, date, createdAt, updatedAt, repsPerSet, numSets, order, exerciseOrder, clientEntryOrder, clientSucceeded, clientNotes, clientUpdatedAt, source, programExerciseId, programSectionTitle, sourceType } = params;
  const name = String(exerciseName || "").trim() || "תרגיל ללא שם";
  const map = repsPerSet || {};
  const keys = Object.keys(map).filter((key) => map[key] !== undefined && map[key] !== null).sort((a, b) => Number(a) - Number(b));

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
        order,
        exerciseOrder,
        clientEntryOrder,
        setOrder: Number(setKey) + 1,
        clientSucceeded,
        clientNotes,
        clientUpdatedAt,
        source,
        programExerciseId,
        programSectionTitle,
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
      order,
      exerciseOrder,
      clientEntryOrder,
      setOrder: idx + 1,
      clientSucceeded,
      clientNotes,
      clientUpdatedAt,
      source,
      programExerciseId,
      programSectionTitle,
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
      order: exercise?.order || workout.order,
      exerciseOrder: exercise?.exerciseOrder || workout.exerciseOrder,
      clientEntryOrder: exercise?.clientEntryOrder || workout.clientEntryOrder,
      clientSucceeded: exercise?.clientSucceeded ?? workout.clientSucceeded,
      clientNotes: exercise?.clientNotes ?? workout.clientNotes,
      clientUpdatedAt: exercise?.clientUpdatedAt ?? workout.clientUpdatedAt,
      source: exercise?.source || workout.source,
      programExerciseId: exercise?.programExerciseId || workout.programExerciseId,
      programSectionTitle: exercise?.programSectionTitle || workout.programSectionTitle,
      sourceType: "embedded_exercise",
    });

    if (normalizedFromMap.length > 0) return normalizedFromMap;

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
      clientSucceeded: exercise?.clientSucceeded ?? workout.clientSucceeded,
      clientNotes: exercise?.clientNotes ?? workout.clientNotes,
      clientUpdatedAt: exercise?.clientUpdatedAt ?? workout.clientUpdatedAt,
      source: exercise?.source || workout.source,
      programExerciseId: exercise?.programExerciseId || workout.programExerciseId,
      programSectionTitle: exercise?.programSectionTitle || workout.programSectionTitle,
      sourceType: "embedded_exercise",
      ...exercise,
    };

    return hasMeaningfulExerciseData(singleRow) ? [singleRow] : [];
  });
}

function normalizeLegacyWorkoutToExercises(workout: WorkoutItem): ExerciseItem[] {
  const hasLegacyMap = !!workout.exerciseName || !!workout.repsPerSet || getNumericValue(workout.numSets) !== null;
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
    order: workout.order,
    exerciseOrder: workout.exerciseOrder,
    clientEntryOrder: workout.clientEntryOrder,
    clientSucceeded: workout.clientSucceeded,
    clientNotes: workout.clientNotes,
    clientUpdatedAt: workout.clientUpdatedAt,
    source: workout.source,
    programExerciseId: workout.programExerciseId,
    programSectionTitle: workout.programSectionTitle,
    sourceType: "legacy_workout",
  });

  if (rows.length > 0) return rows;

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
    order: workout.order,
    exerciseOrder: workout.exerciseOrder,
    clientEntryOrder: workout.clientEntryOrder,
    clientSucceeded: workout.clientSucceeded,
    clientNotes: workout.clientNotes,
    clientUpdatedAt: workout.clientUpdatedAt,
    source: workout.source,
    programExerciseId: workout.programExerciseId,
    programSectionTitle: workout.programSectionTitle,
    sourceType: "legacy_workout",
  };

  return hasMeaningfulExerciseData(fallback) ? [fallback] : [];
}

function normalizeExerciseDocToRows(exercise: ExerciseItem): ExerciseItem[] {
  const normalizedFromMap = normalizeRepsPerSetToRows({
    baseId: exercise.id || `${exercise.workoutId || "exercise"}-doc`,
    uid: exercise.uid,
    workoutId: exercise.workoutId,
    exerciseName: exercise.exerciseName || exercise.name,
    date: exercise.date,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
    repsPerSet: (exercise as any).repsPerSet,
    numSets: exercise.sets,
    order: (exercise as any).order,
    exerciseOrder: (exercise as any).exerciseOrder,
    clientEntryOrder: (exercise as any).clientEntryOrder,
    clientSucceeded: exercise.clientSucceeded,
    clientNotes: exercise.clientNotes,
    clientUpdatedAt: exercise.clientUpdatedAt,
    source: exercise.source,
    programExerciseId: exercise.programExerciseId,
    programSectionTitle: exercise.programSectionTitle,
    sourceType: "exercise_doc",
  });

  if (normalizedFromMap.length > 0) return normalizedFromMap;
  return hasMeaningfulExerciseData(exercise) ? [{ ...exercise, sourceType: "exercise_doc" }] : [];
}

function getItemUpdatedTime(item: Partial<ExerciseItem | WorkoutItem>): number {
  return (
    getDateFromAny(item.updatedAt)?.getTime() ||
    getDateFromAny(item.createdAt)?.getTime() ||
    getDateFromAny(item.date)?.getTime() ||
    0
  );
}

function getMergeSetKey(exercise: ExerciseItem): string {
  const workoutKey = String(exercise.workoutId || exercise.id || "no-workout");
  const nameKey = normalizeText(getExerciseName(exercise));
  const setKey = String(
    getNumberFromAny((exercise as any).setOrder) ??
      getNumberFromAny(exercise.sets) ??
      "no-set"
  );
  return `${workoutKey}|${nameKey}|${setKey}`;
}

function mergeExercises(workouts: WorkoutItem[], exercisesFromCollection: ExerciseItem[]): ExerciseItem[] {
  const exerciseDocRows = exercisesFromCollection.flatMap(normalizeExerciseDocToRows);
  const workoutDerivedRows = workouts.flatMap((workout) => {
    const embedded = normalizeEmbeddedExercises(workout);
    if (embedded.length > 0) return embedded;
    return normalizeLegacyWorkoutToExercises(workout);
  });

  const latestByKey = new Map<string, ExerciseItem>();

  const addExercise = (exercise: ExerciseItem) => {
    if (!hasMeaningfulExerciseData(exercise)) return;

    const key = getMergeSetKey(exercise);
    const existing = latestByKey.get(key);

    if (!existing) {
      latestByKey.set(key, exercise);
      return;
    }

    const existingTime = getItemUpdatedTime(existing);
    const nextTime = getItemUpdatedTime(exercise);

    if (nextTime >= existingTime) {
      latestByKey.set(key, exercise);
    }
  };

  exerciseDocRows.forEach(addExercise);
  workoutDerivedRows.forEach(addExercise);

  return Array.from(latestByKey.values()).sort(compareExercisesBySaveOrder);
}

function groupExercisesByWorkout(workouts: WorkoutItem[], exercises: ExerciseItem[]): Record<string, ExerciseItem[]> {
  const grouped: Record<string, ExerciseItem[]> = {};
  workouts.forEach((workout) => {
    grouped[workout.id] = exercises.filter((exercise) => exercise.workoutId === workout.id).sort(compareExercisesBySaveOrder);
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
    if (noteText) group.notes.push(noteText);
    group.sortTime = Math.max(group.sortTime, workoutDate?.getTime() || 0);
    const latestWorkoutTime = getLatestTimeFromItems([
      workout.createdAt,
      workout.updatedAt,
      workout.date,
      ...workoutExercises.flatMap((exercise) => [exercise.createdAt, exercise.updatedAt, exercise.date]),
    ]);
    const currentLatest = getDateFromAny(group.latestCreatedAt)?.getTime() || 0;
    if (latestWorkoutTime > currentLatest) group.latestCreatedAt = workout.createdAt || workout.updatedAt || workout.date;
  });

  exercises.filter((exercise) => !exercise.workoutId).forEach((exercise) => {
    const exerciseDate = getExerciseBaseDate(exercise);
    const group = ensureGroup(exerciseDate);
    group.exercises.push(exercise);
    group.sortTime = Math.max(group.sortTime, exerciseDate?.getTime() || 0);
  });

  return Object.values(map)
    .map((group) => ({ ...group, notes: Array.from(new Set(group.notes)), exercises: group.exercises.sort(compareExercisesBySaveOrder) }))
    .sort((a, b) => b.sortTime - a.sortTime);
}

function groupExercisesInsideDay(exercises: ExerciseItem[], dayKey: string): GroupedExercise[] {
  const map: Record<string, GroupedExercise> = {};
  exercises.forEach((exercise) => {
    const exerciseName = getExerciseName(exercise);
    const groupKey = `${dayKey}-${exerciseName}`;
    if (!map[groupKey]) map[groupKey] = { key: groupKey, name: exerciseName, rows: [], latestCreatedAt: exercise.createdAt || exercise.updatedAt || exercise.date };
    map[groupKey].rows.push(exercise);
  });

  return Object.values(map)
    .map((group) => {
      const sortedRows = [...group.rows].sort((a, b) => {
        const aSet = getNumericValue(a.sets);
        const bSet = getNumericValue(b.sets);
        if (aSet !== null && bSet !== null && aSet !== bSet) return aSet - bSet;
        return compareExercisesBySaveOrder(a, b);
      });
      const hasRealRows = sortedRows.some((row) => hasSetLikeData(row));
      return { ...group, rows: hasRealRows ? sortedRows.filter((row) => hasSetLikeData(row)) : sortedRows };
    })
    .sort(compareGroupedExercisesBySaveOrder);
}

function getExerciseGroupStatus(rows: ExerciseItem[]) {
  const row = rows.find((item) => item.clientSucceeded === true || item.clientSucceeded === false);
  return row?.clientSucceeded ?? null;
}

function getExerciseGroupClientNotes(rows: ExerciseItem[]) {
  const notes = rows
    .map((row) => String(row.clientNotes || "").trim())
    .filter(Boolean);
  return Array.from(new Set(notes));
}

function getExerciseGroupUpdatedAt(rows: ExerciseItem[]) {
  const row = [...rows]
    .filter((item) => item.clientUpdatedAt)
    .sort((a, b) => (getDateFromAny(b.clientUpdatedAt)?.getTime() || 0) - (getDateFromAny(a.clientUpdatedAt)?.getTime() || 0))[0];
  return row?.clientUpdatedAt || "";
}

function getExerciseGroupProgramSource(rows: ExerciseItem[]) {
  const row = rows.find((item) => item.source === "trainingProgram" || item.programExerciseId || item.programSectionTitle);
  const sectionTitle = String(row?.programSectionTitle || "").trim();
  return sectionTitle ? `מתוך תוכנית כוח · ${sectionTitle}` : row ? "מתוך תוכנית כוח" : "";
}

function calculateAverageWorkoutsPerWeek(dayGroups: DayGroup[]) {
  if (dayGroups.length === 0) return 0;
  const validTimes = dayGroups.map((group) => Number(group.sortTime)).filter((time) => Number.isFinite(time) && time > 0);
  if (validTimes.length === 0) return dayGroups.length;
  const newestWorkoutTime = Math.max(...validTimes);
  const oldestWorkoutTime = Math.min(...validTimes);
  const daysRange = Math.max(1, Math.ceil((newestWorkoutTime - oldestWorkoutTime) / (1000 * 60 * 60 * 24)) + 1);
  const weeksRange = Math.max(1, Math.ceil(daysRange / 7));
  return Math.round(dayGroups.length / weeksRange);
}

export default function ClientProgressTracker({ clients: initialClients = [] }: Props) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  const dynamic = useMemo(() => ({
    titleSize: isSmallScreen ? 18 : isTablet ? 22 : 20,
    textSize: isSmallScreen ? 13 : 14,
    subTextSize: isSmallScreen ? 12 : 13,
    pillHeight: isSmallScreen ? 46 : 50,
    cardPadding: isSmallScreen ? 14 : 16,
  }), [isSmallScreen, isTablet]);

  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [loadingClients, setLoadingClients] = useState(initialClients.length === 0);
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(initialClients[0] || null);
  const [loadingData, setLoadingData] = useState(false);
  const [savingTrackerFlag, setSavingTrackerFlag] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [programData, setProgramData] = useState<TrainingProgramDoc | null>(null);
  const [programDocId, setProgramDocId] = useState<string>("");
  const [selectedTrainingView, setSelectedTrainingView] = useState<TrainingViewType | null>(null);
  const [openDayIds, setOpenDayIds] = useState<Record<string, boolean>>({});
  const [openExerciseIds, setOpenExerciseIds] = useState<Record<string, boolean>>({});
  const [openRunningWeekIds, setOpenRunningWeekIds] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [savingFeedbackKey, setSavingFeedbackKey] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    if (initialClients.length > 0) {
      const normalizedInitial = [...initialClients].sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
      setClients(normalizedInitial);
      setSelectedClient((prev) => (prev ? normalizedInitial.find((c) => c.id === prev.id) || prev : normalizedInitial[0] || null));
      setLoadingClients(false);
      return;
    }

    try {
      setLoadingClients(true);
      const me = auth.currentUser;
      if (!me?.uid) {
        setClients([]);
        setSelectedClient(null);
        return;
      }

      const myUserSnap = await getDoc(doc(db, "users", me.uid));
      const myUser = myUserSnap.data();
      let q;
      if (myUser?.role === "owner") q = query(collection(db, "users"), where("role", "==", "client"));
      else if (myUser?.role === "admin") q = query(collection(db, "users"), where("role", "==", "client"), where("createdByUid", "==", me.uid));
      else {
        setClients([]);
        setSelectedClient(null);
        return;
      }

      const snap = await getDocs(q);
      const list: ClientItem[] = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<ClientItem, "id">) })).sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
      setClients(list);
      setSelectedClient((prev) => (prev ? list.find((c) => c.id === prev.id) || prev : list.find((c) => !!c.showInTracker) || list[0] || null));
    } catch (error) {
      console.error("שגיאה בטעינת לקוחות:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את רשימת הלקוחות");
    } finally {
      setLoadingClients(false);
    }
  }, [initialClients]);



  const getClientUidCandidates = useCallback((client: ClientItem | null) => {
    if (!client) return [] as string[];
    return Array.from(
      new Set(
        [client.authUid, client.uid, client.id]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );
  }, []);

  const fetchDocsForUidCandidates = useCallback(async <T extends { id: string }>(
    collectionName: string,
    uidCandidates: string[]
  ): Promise<T[]> => {
    const seen = new Set<string>();
    const collected: T[] = [];

    for (const uidValue of uidCandidates) {
      const snap = await getDocs(
        query(collection(db, collectionName), where("uid", "==", uidValue))
      );

      snap.docs.forEach((docSnap) => {
        if (seen.has(docSnap.id)) return;
        seen.add(docSnap.id);
        collected.push({
          id: docSnap.id,
          ...(docSnap.data() as Omit<T, "id">),
        } as T);
      });
    }

    return collected;
  }, []);

  const fetchProgramForUidCandidates = useCallback(async (uidCandidates: string[]) => {
    for (const uidValue of uidCandidates) {
      const snap = await getDoc(doc(db, "clientTrainingPrograms", uidValue));
      if (snap.exists()) {
        return {
          docId: snap.id,
          data: snap.data() as TrainingProgramDoc,
        };
      }
    }

    return { docId: uidCandidates[0] || "", data: null as TrainingProgramDoc | null };
  }, []);

  const loadClientData = useCallback(async (client: ClientItem | null) => {
    if (!client) {
      setWorkouts([]);
      setExercises([]);
      setProgramData(null);
      setProgramDocId("");
      return;
    }

    if (!client.showInTracker) {
      setWorkouts([]);
      setExercises([]);
      setProgramData(null);
      setProgramDocId("");
      setLoadingData(false);
      return;
    }

    const uidCandidates = getClientUidCandidates(client);
    if (uidCandidates.length === 0) return;

    try {
      setLoadingData(true);

      const [workoutsListRaw, exercisesFromCollectionRaw, programResult] = await Promise.all([
        fetchDocsForUidCandidates<WorkoutItem>("workouts", uidCandidates),
        fetchDocsForUidCandidates<ExerciseItem>("exercises", uidCandidates),
        fetchProgramForUidCandidates(uidCandidates),
      ]);

      const workoutsList = workoutsListRaw.sort(
        (a, b) => getWorkoutSortTime(b) - getWorkoutSortTime(a)
      );

      const exercisesFromCollection = exercisesFromCollectionRaw.map((exercise) => ({
        ...exercise,
        sourceType: "exercise_doc" as const,
      }));

      setWorkouts(workoutsList);
      setExercises(mergeExercises(workoutsList, exercisesFromCollection));
      setProgramData(programResult.data);
      setProgramDocId(programResult.docId);
    } catch (error) {
      console.error("שגיאה בטעינת נתוני לקוח:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את נתוני הלקוח");
      setWorkouts([]);
      setExercises([]);
      setProgramData(null);
      setProgramDocId("");
    } finally {
      setLoadingData(false);
    }
  }, [fetchDocsForUidCandidates, fetchProgramForUidCandidates, getClientUidCandidates]);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => { loadClientData(selectedClient); }, [selectedClient, loadClientData]);

  const trackedClients = useMemo(() => clients.filter((client) => !!client.showInTracker), [clients]);
  const visibleClients = useMemo(() => {
    const term = normalizeText(searchText);
    if (!term) return trackedClients;
    return clients.filter((client) => normalizeText(client.name || "").startsWith(term));
  }, [clients, trackedClients, searchText]);

  const dayGroups = useMemo(() => buildDayGroups(workouts, exercises), [workouts, exercises]);
  const runningWeeks = useMemo(() => Array.isArray(programData?.runningWeeks) ? programData.runningWeeks : [], [programData]);
  const hasStrengthTracking = dayGroups.length > 0;
  const hasRunningTracking = runningWeeks.length > 0;

  useEffect(() => {
    if (hasStrengthTracking && !hasRunningTracking) setSelectedTrainingView("strength");
    else if (hasRunningTracking && !hasStrengthTracking) setSelectedTrainingView("running");
    else if (!hasStrengthTracking && !hasRunningTracking) setSelectedTrainingView(null);
    else setSelectedTrainingView((prev) => (prev === "strength" || prev === "running" ? prev : null));
  }, [hasStrengthTracking, hasRunningTracking, selectedClient?.id]);

  useEffect(() => {
    if (dayGroups.length > 0) setOpenDayIds({ [dayGroups[0].dayKey]: true });
    else setOpenDayIds({});
    setOpenExerciseIds({});
  }, [dayGroups]);

  useEffect(() => {
    // אימוני ריצה במעקב מוצגים סגורים כברירת מחדל ונפתחים בלחיצה על השבוע.
    setOpenRunningWeekIds({});
  }, [programDocId, selectedClient?.id]);

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const workoutsThisMonth = dayGroups.filter((group) => {
      const d = new Date(group.sortTime);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
    const latestWorkout = dayGroups[0];
    return {
      totalWorkouts: dayGroups.length,
      averageWorkoutsPerWeek: calculateAverageWorkoutsPerWeek(dayGroups),
      workoutsThisMonth,
      latestWorkoutLabel: latestWorkout ? latestWorkout.displayDate : "אין נתונים",
    };
  }, [dayGroups]);

  const toggleDay = (dayKey: string) => setOpenDayIds((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  const toggleExercise = (exerciseKey: string) => setOpenExerciseIds((prev) => ({ ...prev, [exerciseKey]: !prev[exerciseKey] }));
  const toggleRunningWeek = (weekId: string) => setOpenRunningWeekIds((prev) => ({ ...prev, [weekId]: !prev[weekId] }));

  const toggleClientTrackerFlag = useCallback(async () => {
    if (!selectedClient) return;
    const nextValue = !selectedClient.showInTracker;
    try {
      setSavingTrackerFlag(true);
      await updateDoc(doc(db, "users", selectedClient.id), { showInTracker: nextValue, updatedAt: new Date().toISOString() });
      setClients((prev) => prev.map((client) => client.id === selectedClient.id ? { ...client, showInTracker: nextValue } : client));
      setSelectedClient((prev) => prev ? { ...prev, showInTracker: nextValue } : prev);
      if (!nextValue) {
        setWorkouts([]);
        setExercises([]);
        setProgramData(null);
        setProgramDocId("");
      }
      Alert.alert("עודכן בהצלחה", nextValue ? "הלקוח נוסף למעקב וכל האימונים שלו יוצגו." : "הלקוח הוסר מהמעקב.");
    } catch (error) {
      console.error("שגיאה בעדכון מעקב לקוח:", error);
      Alert.alert("שגיאה", "לא ניתן לעדכן את הגדרת המעקב עבור הלקוח");
    } finally {
      setSavingTrackerFlag(false);
    }
  }, [selectedClient]);

  const getDraftValue = (key: string, fallback?: string) => feedbackDrafts[key] ?? String(fallback || "");
  const updateFeedbackDraft = (key: string, value: string) => setFeedbackDrafts((prev) => ({ ...prev, [key]: value }));

  const saveStrengthFeedback = useCallback(async (group: DayGroup) => {
    const workout = group.workouts[0];
    if (!workout) return Alert.alert("שגיאה", "לא נמצא אימון לשמירת משוב");
    const key = `strength-${group.dayKey}`;
    const feedback = getDraftValue(key, workout.coachFeedback).trim();
    try {
      setSavingFeedbackKey(key);
      const updatedAt = new Date().toISOString();

      await updateDoc(doc(db, "workouts", workout.id), {
        coachFeedback: feedback,
        coachFeedbackUpdatedAt: updatedAt,
      });

      const programExerciseIds = Array.from(
        new Set(
          group.exercises
            .map((row) => String(row.programExerciseId || "").trim())
            .filter(Boolean),
        ),
      );

      let nextSections = Array.isArray(programData?.sections) ? programData.sections : [];
      let updatedProgramSections = false;

      if (programExerciseIds.length > 0 && nextSections.length > 0) {
        nextSections = nextSections.map((section: any) => ({
          ...section,
          exercises: Array.isArray(section.exercises)
            ? section.exercises.map((exercise: any) => {
                if (!programExerciseIds.includes(String(exercise.id || ""))) return exercise;
                updatedProgramSections = true;
                return {
                  ...exercise,
                  coachFeedback: feedback,
                  coachFeedbackUpdatedAt: updatedAt,
                };
              })
            : [],
        }));
      }

      const targetProgramDocId =
        programDocId || (selectedClient ? getClientUidCandidates(selectedClient)[0] : "") || "";

      if (updatedProgramSections && targetProgramDocId) {
        await setDoc(
          doc(db, "clientTrainingPrograms", targetProgramDocId),
          {
            sections: nextSections,
            strengthCoachFeedback: feedback,
            strengthCoachFeedbackUpdatedAt: updatedAt,
            updatedAt,
          },
          { merge: true },
        );
      }

      setWorkouts((prev) =>
        prev.map((item) =>
          item.id === workout.id
            ? { ...item, coachFeedback: feedback, coachFeedbackUpdatedAt: updatedAt }
            : item,
        ),
      );

      if (updatedProgramSections) {
        setProgramData((prev) =>
          prev
            ? {
                ...prev,
                sections: nextSections,
                strengthCoachFeedback: feedback,
                strengthCoachFeedbackUpdatedAt: updatedAt,
                updatedAt,
              }
            : prev,
        );
        if (targetProgramDocId) setProgramDocId(targetProgramDocId);
      }

      Alert.alert("נשמר", "המשוב נשמר לאימון הכוח ויוצג גם בתוכנית הכוח של הלקוח");
    } catch (error) {
      console.error("שגיאה בשמירת משוב כוח:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור את המשוב");
    } finally {
      setSavingFeedbackKey(null);
    }
  }, [feedbackDrafts, getClientUidCandidates, programData, programDocId, selectedClient]);

  const saveRunningFeedback = useCallback(async (weekId: string) => {
    if (!selectedClient || !programData) return;
    const targetProgramDocId = programDocId || getClientUidCandidates(selectedClient)[0] || "";
    if (!targetProgramDocId) return;
    const key = `running-${weekId}`;
    const feedback = getDraftValue(key, runningWeeks.find((week) => week.id === weekId)?.coachFeedback).trim();
    try {
      setSavingFeedbackKey(key);
      const updatedAt = new Date().toISOString();
      const nextWeeks = runningWeeks.map((week) => week.id === weekId ? { ...week, coachFeedback: feedback, coachFeedbackUpdatedAt: updatedAt } : week);
      await setDoc(doc(db, "clientTrainingPrograms", targetProgramDocId), { runningWeeks: nextWeeks, updatedAt }, { merge: true });
      setProgramData((prev) => prev ? { ...prev, runningWeeks: nextWeeks, updatedAt } : prev);
      setProgramDocId(targetProgramDocId);
      Alert.alert("נשמר", "המשוב נשמר לאימון הריצה");
    } catch (error) {
      console.error("שגיאה בשמירת משוב ריצה:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור את המשוב");
    } finally {
      setSavingFeedbackKey(null);
    }
  }, [feedbackDrafts, getClientUidCandidates, programData, programDocId, runningWeeks, selectedClient]);

  if (loadingClients) {
    return <View style={styles.loadingBox}><ActivityIndicator size="large" color="#0F172A" /><Text style={styles.loadingText}>טוען רשימת לקוחות...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <UsersIcon size={18} color="#0F172A" />
          <Text style={[styles.headerTitle, { fontSize: dynamic.titleSize }]}>מעקב אימון לקוח</Text>
        </View>
        <Text style={[styles.headerSubtitle, { fontSize: dynamic.subTextSize }]}>המעקב מחולק לאימוני כוח ואימוני ריצה. כאן מוצגים ביצועי הלקוח, תגובתו והמשוב של המאמן.</Text>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchInputWrap}>
          <SearchIcon size={18} color="#64748B" />
          <TextInput value={searchText} onChangeText={setSearchText} placeholder="חיפוש לפי שם לקוח" placeholderTextColor="#94A3B8" style={styles.searchInput} textAlign="right" />
        </View>
      </View>

      {clients.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>אין לקוחות להצגה</Text></View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientsScrollContent}>
          {visibleClients.map((client) => {
            const isSelected = selectedClient?.id === client.id;
            return (
              <Pressable key={client.id} onPress={() => setSelectedClient(client)} style={({ pressed }) => [styles.clientPill, { minHeight: dynamic.pillHeight }, isSelected && styles.clientPillActive, pressed && styles.pressed]}>
                <Text style={[styles.clientPillText, isSelected && styles.clientPillTextActive]} numberOfLines={1}>{client.name || client.email || "לקוח ללא שם"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selectedClient && (
        <View style={styles.selectedClientCard}>
          <View style={styles.selectedClientHeader}>
            <View style={styles.selectedClientInfo}>
              <Text style={styles.selectedClientName}>{selectedClient.name || "לקוח ללא שם"}</Text>
              <Text style={styles.selectedClientEmail}>{selectedClient.email || "ללא אימייל"}</Text>
            </View>
            <View style={styles.trackerSwitchBox}>
              <Text style={styles.trackerSwitchText}>{savingTrackerFlag ? "שומר..." : selectedClient.showInTracker ? "במעקב" : "לא במעקב"}</Text>
              <Switch value={!!selectedClient.showInTracker} onValueChange={toggleClientTrackerFlag} disabled={savingTrackerFlag} trackColor={{ false: "#CBD5E1", true: "#0F172A" }} thumbColor="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.selectedClientStatusText}>{selectedClient.showInTracker ? "הלקוח מסומן למעקב וכל האימונים שלו מוצגים." : "הלקוח לא מסומן למעקב כרגע."}</Text>
        </View>
      )}

      {selectedClient && !selectedClient.showInTracker ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>הלקוח הזה לא מסומן למעקב. הפעילי מעקב כדי לראות אימוני כוח וריצה.</Text></View>
      ) : loadingData ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#0F172A" /><Text style={styles.loadingText}>טוען נתוני לקוח...</Text></View>
      ) : selectedClient ? (
        <>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}><Text style={styles.summaryValue}>{summary.totalWorkouts}</Text><Text style={styles.summaryLabel}>אימוני כוח</Text></View>
            <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}><Text style={styles.summaryValue}>{runningWeeks.length}</Text><Text style={styles.summaryLabel}>שבועות ריצה</Text></View>
            <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}><Text style={styles.summaryValue}>{summary.averageWorkoutsPerWeek}</Text><Text style={styles.summaryLabel}>כוח בשבוע</Text></View>
            <View style={[styles.summaryCard, { padding: dynamic.cardPadding }]}><Text style={styles.summaryValue}>{summary.latestWorkoutLabel}</Text><Text style={styles.summaryLabel}>אימון כוח אחרון</Text></View>
          </View>

          {hasStrengthTracking && hasRunningTracking && !selectedTrainingView ? (
            <View style={styles.choiceCard}>
              <Text style={styles.choiceTitle}>איזה סוג אימון להציג?</Text>
              <Pressable style={styles.choiceButton} onPress={() => setSelectedTrainingView("strength")}><Text style={styles.choiceButtonText}>אימוני כוח</Text></Pressable>
              <Pressable style={styles.choiceButton} onPress={() => setSelectedTrainingView("running")}><Text style={styles.choiceButtonText}>אימוני ריצה</Text></Pressable>
            </View>
          ) : null}

          {hasStrengthTracking && hasRunningTracking && selectedTrainingView ? (
            <View style={styles.viewTabsRow}>
              <Pressable onPress={() => setSelectedTrainingView("strength")} style={[styles.viewTab, selectedTrainingView === "strength" && styles.viewTabActive]}><Text style={[styles.viewTabText, selectedTrainingView === "strength" && styles.viewTabTextActive]}>כוח</Text></Pressable>
              <Pressable onPress={() => setSelectedTrainingView("running")} style={[styles.viewTab, selectedTrainingView === "running" && styles.viewTabActive]}><Text style={[styles.viewTabText, selectedTrainingView === "running" && styles.viewTabTextActive]}>ריצה</Text></Pressable>
            </View>
          ) : null}

          {selectedTrainingView === "strength" && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}><WorkoutIcon size={18} color="#0F172A" /><Text style={styles.sectionTitle}>אימוני כוח - ביצוע, תגובת לקוח ומשוב מאמן</Text></View>
              {dayGroups.length === 0 ? <View style={styles.emptyBox}><Text style={styles.emptyText}>אין אימוני כוח להצגה</Text></View> : dayGroups.map((group) => {
                const isOpen = !!openDayIds[group.dayKey];
                const groupedExercises = groupExercisesInsideDay(group.exercises, group.dayKey);
                const firstWorkout = group.workouts[0];
                const feedbackKey = `strength-${group.dayKey}`;
                const existingFeedback = firstWorkout?.coachFeedback || "";
                return (
                  <View key={group.dayKey} style={styles.dayCard}>
                    <Pressable onPress={() => toggleDay(group.dayKey)} style={({ pressed }) => [styles.dayHeader, pressed && styles.pressed]}>
                      <View style={styles.dayTitleWrap}><Text style={styles.dayTitle}>{group.displayDate}</Text><Text style={styles.daySubtitle}>{groupedExercises.length} תרגילים · נשמר: {formatDateTimeIL(group.latestCreatedAt)}</Text></View>
                      {isOpen ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    </Pressable>

                    {isOpen && (
                      <View style={styles.dayBody}>
                        {group.notes.length > 0 && <View style={styles.clientResponseBox}><Text style={styles.responseTitle}>תגובת / הערות הלקוח</Text>{group.notes.map((note, index) => <Text key={`${group.dayKey}-note-${index}`} style={styles.responseText}>{note}</Text>)}</View>}
                        {groupedExercises.map((exerciseGroup) => {
                          const exerciseOpen = !!openExerciseIds[exerciseGroup.key];
                          const clientStatus = getExerciseGroupStatus(exerciseGroup.rows);
                          const clientNotes = getExerciseGroupClientNotes(exerciseGroup.rows);
                          const clientUpdatedAt = getExerciseGroupUpdatedAt(exerciseGroup.rows);
                          const programSourceLabel = getExerciseGroupProgramSource(exerciseGroup.rows);
                          return (
                            <View key={exerciseGroup.key} style={styles.exerciseGroupCard}>
                              <Pressable onPress={() => toggleExercise(exerciseGroup.key)} style={styles.exerciseHeader}>
                                <View style={styles.exerciseTitleWrap}>
                                  <Text style={styles.exerciseTitle}>{exerciseGroup.name}</Text>
                                  {!!programSourceLabel && <Text style={styles.exerciseSourceText}>{programSourceLabel}</Text>}
                                  <Text style={styles.exerciseStatusText}>סטטוס לקוח: {getSucceededLabel(clientStatus)}</Text>
                                </View>
                                {exerciseOpen ? <ArrowUpIcon size={18} /> : <ArrowDownIcon size={18} />}
                              </Pressable>
                              {exerciseOpen && (
                                <>
                                  <View style={styles.clientResponseBox}>
                                    <Text style={styles.responseTitle}>משוב המתאמן לתרגיל</Text>
                                    <Text style={styles.responseText}>סטטוס: {getSucceededLabel(clientStatus)}</Text>
                                    {clientNotes.length > 0 ? (
                                      clientNotes.map((note, index) => (
                                        <Text key={`${exerciseGroup.key}-client-note-${index}`} style={styles.responseText}>פירוט: {note}</Text>
                                      ))
                                    ) : (
                                      <Text style={styles.responseMuted}>לא הוזן פירוט מהלקוח</Text>
                                    )}
                                    {!!clientUpdatedAt && <Text style={styles.responseMuted}>עודכן: {formatDateTimeIL(clientUpdatedAt)}</Text>}
                                  </View>
                                  <View style={styles.setsTable}>
                                    {exerciseGroup.rows.map((row, index) => (
                                      <View key={row.id || `${exerciseGroup.key}-${index}`} style={styles.setRow}>
                                        <Text style={styles.setCell}>סט {row.sets || index + 1}</Text>
                                        <Text style={styles.setCell}>חזרות: {row.reps || "-"}</Text>
                                        <Text style={styles.setCell}>משקל: {row.weight || "-"}</Text>
                                      </View>
                                    ))}
                                  </View>
                                </>
                              )}
                            </View>
                          );
                        })}
                        <View style={styles.feedbackBox}>
                          <Text style={styles.feedbackTitle}>משוב מאמן ללקוח</Text>
                          <TextInput value={getDraftValue(feedbackKey, existingFeedback)} onChangeText={(value) => updateFeedbackDraft(feedbackKey, value)} placeholder="כתבי משוב שיוצג ללקוח ליד האימון" placeholderTextColor="#94A3B8" style={styles.feedbackInput} multiline textAlign="right" />
                          {!!firstWorkout?.coachFeedbackUpdatedAt && <Text style={styles.feedbackUpdatedText}>עודכן: {formatDateTimeIL(firstWorkout.coachFeedbackUpdatedAt)}</Text>}
                          <Pressable onPress={() => saveStrengthFeedback(group)} disabled={savingFeedbackKey === feedbackKey} style={[styles.saveFeedbackButton, savingFeedbackKey === feedbackKey && styles.disabledButton]}>{savingFeedbackKey === feedbackKey ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveFeedbackButtonText}>שמור משוב</Text>}</Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {selectedTrainingView === "running" && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}><WorkoutIcon size={18} color="#0F172A" /><Text style={styles.sectionTitle}>אימוני ריצה - ביצוע, תגובת לקוח ומשוב מאמן</Text></View>
              {runningWeeks.length === 0 ? <View style={styles.emptyBox}><Text style={styles.emptyText}>אין אימוני ריצה להצגה</Text></View> : runningWeeks.map((week, index) => {
                const weekId = week.id || `running-week-${index}`;
                const feedbackKey = `running-${weekId}`;
                const isOpen = !!openRunningWeekIds[weekId];
                return (
                  <View key={weekId} style={styles.runningWeekCard}>
                    <Pressable onPress={() => toggleRunningWeek(weekId)} style={({ pressed }) => [styles.runningWeekHeaderPressable, pressed && styles.pressedLight]}>
                      <View style={styles.runningWeekHeaderRow}>
                        <Text style={styles.runningWeekToggleText}>{isOpen ? "סגירה" : "פתיחה"}</Text>
                        <View style={styles.runningWeekHeaderTextWrap}>
                          <Text style={styles.runningWeekTitle}>שבוע {week.weekNumber || index + 1}</Text>
                          <Text style={styles.runningWeekStatusLine}>סטטוס לקוח: {getSucceededLabel(week.clientSucceeded)}</Text>
                        </View>
                      </View>
                    </Pressable>

                    {isOpen && (
                      <>
                        <View style={styles.runningMetaRow}>
                          {!!String(week.distanceKm || "").trim() && <View style={styles.metaChip}><Text style={styles.metaChipText}>מרחק: {week.distanceKm} ק״מ</Text></View>}
                          {!!String(week.pacePerKm || "").trim() && <View style={styles.metaChip}><Text style={styles.metaChipText}>קצב: {week.pacePerKm}</Text></View>}
                          <View style={styles.metaChip}><Text style={styles.metaChipText}>{getPaceTypeLabel(week.paceType)}</Text></View>
                          <View style={styles.metaChip}><Text style={styles.metaChipText}>{getManipulationLabel(week.manipulationType)}</Text></View>
                        </View>
                        {!!String(week.notes || "").trim() && <Text style={styles.runningNotes}>{week.notes}</Text>}

                        <View style={styles.clientResponseBox}>
                          <Text style={styles.responseTitle}>תגובת הלקוח</Text>
                          <Text style={styles.responseText}>סטטוס: {getSucceededLabel(week.clientSucceeded)}</Text>
                          {!!String(week.clientNotes || "").trim() ? <Text style={styles.responseText}>פירוט: {week.clientNotes}</Text> : <Text style={styles.responseMuted}>לא הוזן פירוט מהלקוח</Text>}
                          {!!week.clientUpdatedAt && <Text style={styles.responseMuted}>עודכן: {formatDateTimeIL(week.clientUpdatedAt)}</Text>}
                        </View>

                        <View style={styles.feedbackBox}>
                          <Text style={styles.feedbackTitle}>משוב מאמן ללקוח</Text>
                          <TextInput value={getDraftValue(feedbackKey, week.coachFeedback)} onChangeText={(value) => updateFeedbackDraft(feedbackKey, value)} placeholder="כתבי משוב שיוצג ללקוח ליד שבוע הריצה" placeholderTextColor="#94A3B8" style={styles.feedbackInput} multiline textAlign="right" />
                          {!!week.coachFeedbackUpdatedAt && <Text style={styles.feedbackUpdatedText}>עודכן: {formatDateTimeIL(week.coachFeedbackUpdatedAt)}</Text>}
                          <Pressable onPress={() => saveRunningFeedback(weekId)} disabled={savingFeedbackKey === feedbackKey} style={[styles.saveFeedbackButton, savingFeedbackKey === feedbackKey && styles.disabledButton]}>{savingFeedbackKey === feedbackKey ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveFeedbackButtonText}>שמור משוב</Text>}</Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {!hasStrengthTracking && !hasRunningTracking && <View style={styles.emptyBox}><Text style={styles.emptyText}>אין עדיין אימוני כוח או ריצה להצגה עבור הלקוח</Text></View>}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: 14 },
  topHeader: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 16, gap: 6 },
  headerTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, justifyContent: "flex-start" },
  headerTitle: { color: "#0F172A", fontWeight: "900", textAlign: "right" },
  headerSubtitle: { color: "#64748B", lineHeight: 20, textAlign: "right" },
  searchCard: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", padding: 12 },
  searchInputWrap: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: "#CBD5E1", paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 48, color: "#0F172A", fontSize: 14, writingDirection: "rtl" },
  clientsScrollContent: { gap: 10, paddingVertical: 2 },
  clientPill: { minWidth: 130, maxWidth: 210, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  clientPillActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  clientPillText: { color: "#0F172A", fontSize: 14, fontWeight: "800", textAlign: "center" },
  clientPillTextActive: { color: "#FFFFFF" },
  selectedClientCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, gap: 10 },
  selectedClientHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 12 },
  selectedClientInfo: { flex: 1, alignItems: "flex-end" },
  selectedClientName: { color: "#0F172A", fontSize: 16, fontWeight: "900", textAlign: "right" },
  selectedClientEmail: { color: "#64748B", fontSize: 13, textAlign: "right", marginTop: 3 },
  trackerSwitchBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  trackerSwitchText: { color: "#334155", fontSize: 13, fontWeight: "800", textAlign: "right" },
  selectedClientStatusText: { color: "#64748B", fontSize: 13, textAlign: "right", lineHeight: 20 },
  summaryGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  summaryCard: { flexGrow: 1, flexBasis: "45%", backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center", minHeight: 88 },
  summaryValue: { color: "#0F172A", fontSize: 20, fontWeight: "900", textAlign: "center" },
  summaryLabel: { color: "#64748B", fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 6 },
  choiceCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 16, gap: 12 },
  choiceTitle: { color: "#0F172A", fontSize: 16, fontWeight: "900", textAlign: "center" },
  choiceButton: { minHeight: 50, borderRadius: 16, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", alignItems: "center", justifyContent: "center" },
  choiceButtonText: { color: "#1D4ED8", fontSize: 14, fontWeight: "900", textAlign: "center" },
  viewTabsRow: { flexDirection: "row-reverse", gap: 10 },
  viewTab: { flex: 1, minHeight: 46, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  viewTabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  viewTabText: { color: "#334155", fontSize: 14, fontWeight: "900", textAlign: "center" },
  viewTabTextActive: { color: "#FFFFFF" },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, justifyContent: "flex-start" },
  sectionTitle: { color: "#0F172A", fontSize: 16, fontWeight: "900", textAlign: "right", flex: 1 },
  dayCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  dayHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 14, gap: 12 },
  dayTitleWrap: { flex: 1, alignItems: "flex-end" },
  dayTitle: { color: "#0F172A", fontSize: 16, fontWeight: "900", textAlign: "right" },
  daySubtitle: { color: "#64748B", fontSize: 12, fontWeight: "600", textAlign: "right", marginTop: 4 },
  dayBody: { borderTopWidth: 1, borderTopColor: "#E2E8F0", padding: 12, gap: 12 },
  clientResponseBox: { backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, gap: 6 },
  responseTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900", textAlign: "right" },
  responseText: { color: "#334155", fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" },
  responseMuted: { color: "#64748B", fontSize: 12, lineHeight: 18, textAlign: "right" },
  exerciseGroupCard: { backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  exerciseHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 12 },
  exerciseTitle: { flex: 1, color: "#0F172A", fontSize: 14, fontWeight: "900", textAlign: "right" },
  setsTable: { borderTopWidth: 1, borderTopColor: "#E2E8F0", padding: 8, gap: 6 },
  setRow: { flexDirection: "row-reverse", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  setCell: { flex: 1, color: "#334155", fontSize: 12, fontWeight: "700", textAlign: "right" },
  feedbackBox: { backgroundColor: "#FFFBEB", borderRadius: 16, borderWidth: 1, borderColor: "#FDE68A", padding: 12, gap: 8 },
  feedbackTitle: { color: "#92400E", fontSize: 14, fontWeight: "900", textAlign: "right" },
  feedbackInput: { minHeight: 86, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#FDE68A", color: "#0F172A", fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top", writingDirection: "rtl" },
  feedbackUpdatedText: { color: "#92400E", fontSize: 12, fontWeight: "700", textAlign: "right" },
  saveFeedbackButton: { minHeight: 46, borderRadius: 14, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  saveFeedbackButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", textAlign: "center" },
  runningWeekCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, gap: 12 },
  runningWeekHeaderPressable: { width: "100%", borderRadius: 16, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", paddingVertical: 12, paddingHorizontal: 12 },
  runningWeekHeaderRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  runningWeekHeaderTextWrap: { flex: 1, alignItems: "flex-end", gap: 3 },
  runningWeekToggleText: { color: "#2563EB", fontSize: 12, fontWeight: "900", textAlign: "left" },
  runningWeekStatusLine: { color: "#64748B", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  runningWeekTitle: { color: "#0F172A", fontSize: 16, fontWeight: "900", textAlign: "right" },
  runningMetaRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  metaChip: { backgroundColor: "#E2E8F0", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  metaChipText: { color: "#334155", fontSize: 12, fontWeight: "800", textAlign: "center" },
  runningNotes: { color: "#475569", fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" },
  loadingBox: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", paddingVertical: 24, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#64748B", fontSize: 14, fontWeight: "700", textAlign: "center" },
  emptyBox: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", paddingVertical: 22, paddingHorizontal: 14, alignItems: "center" },
  emptyText: { color: "#64748B", fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 20 },
  pressed: { opacity: 0.82 },
  disabledButton: { opacity: 0.55 },
});
