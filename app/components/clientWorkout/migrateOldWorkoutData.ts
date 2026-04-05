import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../database/firebase";

type OldWorkoutDoc = {
  uid?: string;
  date?: string;
  dateKey?: string;
  exerciseName?: string;
  numSets?: number;
  repsPerSet?: Record<string, { reps?: string; weight?: string }>;
  createdAt?: string;
  updatedAt?: string;
  migrated?: boolean;
};

export async function migrateOldWorkoutDataForAllUsers() {
  const workoutsSnap = await getDocs(collection(db, "workouts"));

  let migratedCount = 0;

  for (const workoutDoc of workoutsSnap.docs) {
    const data = workoutDoc.data() as OldWorkoutDoc;

    const isOldStructure =
      !!data.exerciseName &&
      !!data.numSets &&
      !!data.repsPerSet &&
      !data.migrated;

    if (!isOldStructure || !data.uid) {
      continue;
    }

    const originalWorkoutId = workoutDoc.id;
    const nowIso = new Date().toISOString();
    const workoutDate = data.date || nowIso;
    const dateKey =
      data.dateKey ||
      new Intl.DateTimeFormat("en-CA").format(new Date(workoutDate));
    const createdAt = data.createdAt || nowIso;
    const updatedAt = data.updatedAt || createdAt;
    const exerciseName = String(data.exerciseName || "").trim();

    if (!exerciseName) continue;

    const repsPerSet = data.repsPerSet || {};
    const exerciseRows = Object.keys(repsPerSet)
      .sort((a, b) => Number(a) - Number(b))
      .map((setKey) => {
        const setData = repsPerSet[setKey] || {};
        return {
          exerciseName,
          name: exerciseName,
          sets: Number(setKey) + 1,
          reps: Number(setData.reps || 0),
          weight: Number(setData.weight || 0),
          date: workoutDate,
          createdAt,
          updatedAt,
        };
      });

    const newWorkoutRef = await addDoc(collection(db, "workouts"), {
      uid: data.uid,
      title: exerciseName,
      name: exerciseName,
      date: workoutDate,
      dateKey,
      createdAt,
      updatedAt,
      exercises: exerciseRows,
      migratedFromOldWorkoutId: originalWorkoutId,
      migrated: true,
    });

    for (const row of exerciseRows) {
      await addDoc(collection(db, "exercises"), {
        uid: data.uid,
        workoutId: newWorkoutRef.id,
        exerciseName: row.exerciseName,
        name: row.name,
        sets: row.sets,
        reps: row.reps,
        weight: row.weight,
        date: row.date,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        migrated: true,
        migratedFromOldWorkoutId: originalWorkoutId,
      });
    }

    await updateDoc(doc(db, "workouts", originalWorkoutId), {
      migrated: true,
      migratedToWorkoutId: newWorkoutRef.id,
      oldStructure: true,
    });

    migratedCount += 1;
  }

  return {
    success: true,
    migratedCount,
  };
}