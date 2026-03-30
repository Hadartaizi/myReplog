import { ClientSummary, ExerciseItem, WorkoutItem } from "./types";

export function getDateFromAny(value: any): Date | null {
  if (!value) return null;

  if (value?.toDate && typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value?.seconds) {
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

export function getWorkoutDisplayDate(workout: WorkoutItem): string {
  return formatDateIL(
    workout.date ||
      workout.createdAt ||
      workout.updatedAt
  );
}

export function getWorkoutSortTime(workout: WorkoutItem): number {
  const date =
    getDateFromAny(workout.date) ||
    getDateFromAny(workout.createdAt) ||
    getDateFromAny(workout.updatedAt);

  return date ? date.getTime() : 0;
}

export function getWorkoutTitle(workout: WorkoutItem): string {
  return workout.title || workout.name || "אימון";
}

export function getExerciseName(exercise: ExerciseItem): string {
  return exercise.exerciseName || exercise.name || "תרגיל ללא שם";
}

export function getNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

export function hasMeaningfulExerciseData(exercise: ExerciseItem): boolean {
  const hasName = !!getExerciseName(exercise).trim();
  const hasSets = getNumericValue(exercise.sets) !== null;
  const hasReps = getNumericValue(exercise.reps) !== null;
  const hasWeight = getNumericValue(exercise.weight) !== null;

  return hasName || hasSets || hasReps || hasWeight;
}

export function hasMeaningfulWorkoutData(
  workout: WorkoutItem,
  workoutExercises: ExerciseItem[] = []
): boolean {
  const hasNotes = !!String(workout.note || workout.notes || "").trim();
  const hasRealExercises = workoutExercises.some((exercise) =>
    hasMeaningfulExerciseData(exercise)
  );

  return hasNotes || hasRealExercises;
}

export function buildClientSummary(
  workouts: WorkoutItem[],
  exercises: ExerciseItem[]
): ClientSummary {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const workoutsThisMonth = workouts.filter((workout) => {
    const d =
      getDateFromAny(workout.date) ||
      getDateFromAny(workout.createdAt) ||
      getDateFromAny(workout.updatedAt);

    if (!d) return false;

    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const latestWorkout = [...workouts].sort(
    (a, b) => getWorkoutSortTime(b) - getWorkoutSortTime(a)
  )[0];

  const uniqueNames = new Set(
    exercises
      .map((exercise) => getExerciseName(exercise).trim())
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
    grouped[workout.id] = exercises.filter(
      (exercise) => exercise.workoutId === workout.id
    );
  });

  return grouped;
}