import { ClientSummary, ExerciseItem, WorkoutItem } from "./types";

export function getDateFromAny(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (value?.toDate && typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.seconds === "number"
  ) {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export function formatDateIL(value: any): string {
  const date = getDateFromAny(value);
  if (!date) return "אין תאריך";

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeIL(value: any): string {
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

export function getWorkoutDate(workout: WorkoutItem): Date | null {
  return (
    getDateFromAny(workout.date) ||
    getDateFromAny(workout.createdAt) ||
    getDateFromAny(workout.updatedAt)
  );
}

export function getWorkoutDisplayDate(workout: WorkoutItem): string {
  return formatDateIL(workout.date || workout.createdAt || workout.updatedAt);
}

export function getWorkoutCreatedLabel(workout: WorkoutItem): string {
  return formatDateTimeIL(workout.createdAt || workout.updatedAt || workout.date);
}

export function getWorkoutSortTime(workout: WorkoutItem): number {
  const date = getWorkoutDate(workout);
  return date ? date.getTime() : 0;
}

export function getWorkoutTitle(workout: WorkoutItem): string {
  return String(workout.title || workout.name || "אימון").trim() || "אימון";
}

export function getExerciseName(exercise: ExerciseItem): string {
  return String(exercise.exerciseName || exercise.name || "").trim();
}

export function getExerciseDisplayName(exercise: ExerciseItem): string {
  const name = getExerciseName(exercise);
  return name || "תרגיל ללא שם";
}

export function getNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function hasMeaningfulExerciseData(exercise: ExerciseItem): boolean {
  const hasName = !!getExerciseName(exercise);
  const hasSets = getNumericValue(exercise.sets) !== null;
  const hasReps = getNumericValue(exercise.reps) !== null;
  const hasWeight = getNumericValue(exercise.weight) !== null;

  return hasName || hasSets || hasReps || hasWeight;
}

export function hasMeaningfulWorkoutData(
  workout: WorkoutItem,
  workoutExercises: ExerciseItem[] = []
): boolean {
  const hasTitle = !!getWorkoutTitle(workout).trim();
  const hasNotes = !!String(workout.note || workout.notes || "").trim();
  const hasRealExercises = workoutExercises.some((exercise) =>
    hasMeaningfulExerciseData(exercise)
  );

  return hasTitle || hasNotes || hasRealExercises;
}

export function buildClientSummary(
  workouts: WorkoutItem[],
  exercises: ExerciseItem[]
): ClientSummary {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const workoutsThisMonth = workouts.filter((workout) => {
    const d = getWorkoutDate(workout);
    if (!d) return false;

    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const latestWorkout = [...workouts].sort(
    (a, b) => getWorkoutSortTime(b) - getWorkoutSortTime(a)
  )[0];

  const uniqueNames = new Set(
    exercises
      .map((exercise) => getExerciseName(exercise))
      .filter(Boolean)
  );

  return {
    totalWorkouts: workouts.length,
    totalExercises: exercises.length,
    uniqueExercises: uniqueNames.size,
    workoutsThisMonth,
    latestWorkoutLabel: latestWorkout
      ? getWorkoutDisplayDate(latestWorkout)
      : "אין נתונים",
  };
}

export function groupExercisesByWorkout(
  workouts: WorkoutItem[],
  exercises: ExerciseItem[]
) {
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

export function normalizeEmbeddedExercises(
  workout: WorkoutItem
): ExerciseItem[] {
  if (!Array.isArray(workout.exercises)) return [];

  return workout.exercises
    .map((exercise: any, index: number) => ({
      id: `${workout.id}-embedded-${index}`,
      uid: workout.uid,
      workoutId: workout.id,
      name: exercise?.name,
      exerciseName: exercise?.exerciseName || exercise?.name,
      sets: exercise?.sets,
      reps: exercise?.reps,
      weight: exercise?.weight,
      date: exercise?.date || workout.date,
      createdAt: exercise?.createdAt || workout.createdAt,
      updatedAt: exercise?.updatedAt || workout.updatedAt,
      ...exercise,
    }))
    .filter(hasMeaningfulExerciseData);
}

export function mergeExercises(
  workouts: WorkoutItem[],
  exercisesFromCollection: ExerciseItem[]
): ExerciseItem[] {
  const embeddedExercises = workouts.flatMap((workout) =>
    normalizeEmbeddedExercises(workout)
  );

  const all = [...exercisesFromCollection, ...embeddedExercises];

  const seen = new Set<string>();

  return all.filter((exercise, index) => {
    const key = exercise.id || `${exercise.workoutId || "none"}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return hasMeaningfulExerciseData(exercise);
  });
}