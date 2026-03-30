export type ClientItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: "admin" | "client";
};

export type WorkoutItem = {
  id: string;
  uid?: string;
  name?: string;
  title?: string;
  date?: string;
  createdAt?: any;
  updatedAt?: any;
  note?: string;
  notes?: string;
  exercises?: any[];
  [key: string]: any;
};

export type ExerciseItem = {
  id: string;
  uid?: string;
  workoutId?: string;
  name?: string;
  exerciseName?: string;
  sets?: number | string;
  reps?: number | string;
  weight?: number | string;
  createdAt?: any;
  date?: string;
  [key: string]: any;
};

export type ClientSummary = {
  totalWorkouts: number;
  totalExercises: number;
  uniqueExercises: number;
  workoutsThisMonth: number;
  latestWorkoutLabel: string;
};