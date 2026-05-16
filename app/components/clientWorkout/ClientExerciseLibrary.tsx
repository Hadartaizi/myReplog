import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../database/firebase";

type ExerciseItem = {
  id: string;
  uid?: string;
  authUid?: string | null;
  name?: string;
  exerciseName?: string;
  title?: string;
  updatedAt?: string;
  createdAt?: string;
};

const normalizeExerciseName = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[^֐-׿\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getExerciseDisplayName = (exercise: ExerciseItem) =>
  String(exercise.exerciseName || exercise.name || exercise.title || "").trim();

export default function ClientExerciseLibrary() {
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [editingExerciseId, setEditingExerciseId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [savingExerciseId, setSavingExerciseId] = useState("");
  const [deletingExerciseId, setDeletingExerciseId] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isEditFocused, setIsEditFocused] = useState(false);

  const currentUid = String(auth.currentUser?.uid || "").trim();

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const confirmAction = async (title: string, message: string) => {
    if (Platform.OS === "web") {
      return window.confirm(`${title}\n\n${message}`);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        {
          text: "ביטול",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "אישור",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ]);
    });
  };

  const sortExercises = useCallback((items: ExerciseItem[]) => {
    return [...items].sort((a, b) =>
      getExerciseDisplayName(a).localeCompare(getExerciseDisplayName(b), "he")
    );
  }, []);

  const fetchExercisesDocs = useCallback(async () => {
    if (!currentUid) return [] as ExerciseItem[];

    const byUidSnap = await getDocs(
      query(collection(db, "exercises"), where("uid", "==", currentUid))
    );

    const byAuthUidSnap = await getDocs(
      query(collection(db, "exercises"), where("authUid", "==", currentUid))
    );

    const exercisesMap = new Map<string, ExerciseItem>();

    [...byUidSnap.docs, ...byAuthUidSnap.docs].forEach((docSnap) => {
      const data = docSnap.data() || {};
      exercisesMap.set(docSnap.id, {
        id: docSnap.id,
        ...data,
      } as ExerciseItem);
    });

    return Array.from(exercisesMap.values());
  }, [currentUid]);

  const dedupeExercisesInDatabase = useCallback(async () => {
    const docs = await fetchExercisesDocs();
    const grouped = new Map<string, ExerciseItem[]>();

    docs.forEach((item) => {
      const normalized = normalizeExerciseName(getExerciseDisplayName(item));
      if (!normalized) return;
      const arr = grouped.get(normalized) || [];
      arr.push(item);
      grouped.set(normalized, arr);
    });

    for (const [, items] of grouped.entries()) {
      if (items.length <= 1) continue;

      const sorted = [...items].sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });

      const keeper = sorted[0];
      const duplicates = sorted.slice(1);

      for (const duplicate of duplicates) {
        await deleteDoc(doc(db, "exercises", duplicate.id));
      }

      const keeperName = getExerciseDisplayName(keeper).trim();

      await updateDoc(doc(db, "exercises", keeper.id), {
        exerciseName: keeperName,
        name: keeperName,
        title: keeperName,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [fetchExercisesDocs]);

  const loadExercises = useCallback(async () => {
    if (!currentUid) {
      setExercises([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await dedupeExercisesInDatabase();
      const docs = await fetchExercisesDocs();
      setExercises(sortExercises(docs));
    } catch (error) {
      console.error("שגיאה בטעינת מאגר התרגילים:", error);
      showAlert("שגיאה", "לא ניתן לטעון את מאגר התרגילים");
    } finally {
      setLoading(false);
    }
  }, [currentUid, dedupeExercisesInDatabase, fetchExercisesDocs, sortExercises]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const filteredExercises = useMemo(() => {
    const normalizedSearch = normalizeExerciseName(searchText);

    if (!normalizedSearch) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      normalizeExerciseName(getExerciseDisplayName(exercise)).includes(
        normalizedSearch
      )
    );
  }, [exercises, searchText]);

  const exerciseCountLabel = useMemo(() => {
    const count = exercises.length;
    if (count === 1) return "תרגיל אחד";
    return `${count} תרגילים`;
  }, [exercises]);

  const filteredCountLabel = useMemo(() => {
    const count = filteredExercises.length;
    if (!searchText.trim()) return "";
    if (count === 1) return "נמצא תרגיל אחד";
    return `נמצאו ${count} תרגילים`;
  }, [filteredExercises.length, searchText]);

  const handleStartEdit = (exercise: ExerciseItem) => {
    setEditingExerciseId(exercise.id);
    setEditingName(getExerciseDisplayName(exercise));
    setIsEditFocused(false);
  };

  const handleCancelEdit = () => {
    setEditingExerciseId("");
    setEditingName("");
    setIsEditFocused(false);
  };

  const renameExerciseEverywhere = useCallback(
    async (oldName: string, newName: string, currentExerciseId: string) => {
      const normalizedOld = normalizeExerciseName(oldName);
      const normalizedNew = normalizeExerciseName(newName);

      if (!normalizedOld || !normalizedNew) return;

      const nowIso = new Date().toISOString();

      const workoutsByUidSnap = await getDocs(
        query(collection(db, "workouts"), where("uid", "==", currentUid))
      );

      const workoutsByAuthUidSnap = await getDocs(
        query(collection(db, "workouts"), where("authUid", "==", currentUid))
      );

      const workoutMap = new Map<string, any>();
      [...workoutsByUidSnap.docs, ...workoutsByAuthUidSnap.docs].forEach(
        (docSnap) => {
          workoutMap.set(docSnap.id, docSnap);
        }
      );

      for (const docSnap of workoutMap.values()) {
        const data = docSnap.data() || {};
        const currentName = String(
          data.exerciseName || data.name || data.title || ""
        ).trim();
        const normalizedCurrent = normalizeExerciseName(currentName);

        if (
          normalizedCurrent === normalizedOld ||
          normalizedCurrent === normalizedNew
        ) {
          await updateDoc(doc(db, "workouts", docSnap.id), {
            exerciseName: newName.trim(),
            name: newName.trim(),
            title: newName.trim(),
            updatedAt: nowIso,
          });
        }
      }

      const exercisesDocs = await fetchExercisesDocs();

      const matches = exercisesDocs.filter((item) => {
        const currentName = getExerciseDisplayName(item);
        const normalizedCurrent = normalizeExerciseName(currentName);
        return (
          normalizedCurrent === normalizedOld ||
          normalizedCurrent === normalizedNew
        );
      });

      const sortedMatches = [...matches].sort((a, b) => {
        if (a.id === currentExerciseId) return -1;
        if (b.id === currentExerciseId) return 1;

        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });

      const keeper = sortedMatches[0];

      if (keeper) {
        await updateDoc(doc(db, "exercises", keeper.id), {
          exerciseName: newName.trim(),
          name: newName.trim(),
          title: newName.trim(),
          updatedAt: nowIso,
        });

        for (const item of sortedMatches.slice(1)) {
          await deleteDoc(doc(db, "exercises", item.id));
        }
      }
    },
    [currentUid, fetchExercisesDocs]
  );

  const handleSaveEdit = async (exercise: ExerciseItem) => {
    const trimmedName = editingName.trim();
    const oldName = getExerciseDisplayName(exercise).trim();

    if (!trimmedName) {
      showAlert("שגיאה", "יש להזין שם תרגיל");
      return;
    }

    try {
      setSavingExerciseId(exercise.id);
      await renameExerciseEverywhere(oldName, trimmedName, exercise.id);
      setEditingExerciseId("");
      setEditingName("");
      setIsEditFocused(false);
      await loadExercises();
      showAlert("הצלחה", "שם התרגיל עודכן בכל המערכת");
    } catch (error) {
      console.error("שגיאה בעדכון התרגיל:", error);
      showAlert("שגיאה", "לא ניתן לעדכן את שם התרגיל");
    } finally {
      setSavingExerciseId("");
    }
  };

  const handleDeleteExercise = async (exercise: ExerciseItem) => {
    const exerciseName = getExerciseDisplayName(exercise) || "תרגיל ללא שם";
    const normalizedTarget = normalizeExerciseName(exerciseName);

    const confirmed = await confirmAction(
      "מחיקת תרגיל",
      `האם למחוק לצמיתות את התרגיל "${exerciseName}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingExerciseId(exercise.id);

      const exercisesDocs = await fetchExercisesDocs();

      const matches = exercisesDocs.filter(
        (item) =>
          normalizeExerciseName(getExerciseDisplayName(item)) === normalizedTarget
      );

      for (const item of matches) {
        await deleteDoc(doc(db, "exercises", item.id));
      }

      setExercises((prev) =>
        prev.filter(
          (item) =>
            normalizeExerciseName(getExerciseDisplayName(item)) !==
            normalizedTarget
        )
      );

      if (
        editingExerciseId &&
        normalizeExerciseName(getExerciseDisplayName(exercise)) ===
          normalizedTarget
      ) {
        setEditingExerciseId("");
        setEditingName("");
        setIsEditFocused(false);
      }

      showAlert("בוצע", "התרגיל נמחק");
    } catch (error) {
      console.error("שגיאה במחיקת התרגיל:", error);
      showAlert("שגיאה", "לא ניתן למחוק את התרגיל");
    } finally {
      setDeletingExerciseId("");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.loadingText}>טוען מאגר תרגילים...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerCard}>
        <View style={styles.headerTextWrapOnly}>
          <Text style={styles.title}>מאגר תרגילים</Text>
          <Text style={styles.subtitle}>
            כאן אפשר לראות את כל התרגילים שהזנת, לחפש תרגיל ספציפי, לערוך שם
            בלי כפילויות ולמחוק לצמיתות
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{exerciseCountLabel}</Text>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchLabel}>חיפוש תרגיל</Text>

          <View
            style={[
              styles.inputWithClearWrap,
              isSearchFocused && styles.inputWithClearWrapFocused,
            ]}
          >
            {!!searchText.trim() && (
              <Pressable
                onPress={() => setSearchText("")}
                style={({ pressed }) => [
                  styles.clearInsideButton,
                  pressed && styles.pressed,
                ]}
                hitSlop={8}
              >
                <Text style={styles.clearInsideButtonText}>✕</Text>
              </Pressable>
            )}

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="הקלידי שם תרגיל לחיפוש"
              placeholderTextColor="#8F8F96"
              style={styles.inputWithClearField}
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
          </View>

          {!!searchText.trim() && (
            <Text style={styles.searchResultText}>{filteredCountLabel}</Text>
          )}
        </View>
      </View>

      {exercises.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>עדיין לא הזנת תרגילים למאגר</Text>
        </View>
      ) : filteredExercises.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>לא נמצא תרגיל שמתאים לחיפוש</Text>
        </View>
      ) : (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {filteredExercises.map((exercise) => {
            const isEditing = editingExerciseId === exercise.id;
            const isSaving = savingExerciseId === exercise.id;
            const isDeleting = deletingExerciseId === exercise.id;
            const exerciseName =
              getExerciseDisplayName(exercise) || "תרגיל ללא שם";

            return (
              <View key={exercise.id} style={styles.exerciseCard}>
                {isEditing ? (
                  <>
                    <Text style={styles.inputLabel}>שם התרגיל</Text>

                    <View
                      style={[
                        styles.inputWithClearWrap,
                        isEditFocused && styles.inputWithClearWrapFocused,
                      ]}
                    >
                      {!!editingName.trim() && (
                        <Pressable
                          onPress={() => setEditingName("")}
                          style={({ pressed }) => [
                            styles.clearInsideButton,
                            pressed && styles.pressed,
                          ]}
                          hitSlop={8}
                        >
                          <Text style={styles.clearInsideButtonText}>✕</Text>
                        </Pressable>
                      )}

                      <TextInput
                        value={editingName}
                        onChangeText={setEditingName}
                        placeholder="הקלידי שם תרגיל"
                        placeholderTextColor="#8F8F96"
                        style={styles.inputWithClearField}
                        textAlign="right"
                        autoCapitalize="none"
                        onFocus={() => setIsEditFocused(true)}
                        onBlur={() => setIsEditFocused(false)}
                      />
                    </View>

                    <View style={styles.editActionsRow}>
                      <Pressable
                        onPress={handleCancelEdit}
                        disabled={isSaving}
                        style={({ pressed }) => [
                          styles.cancelButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cancelButtonText}>ביטול</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleSaveEdit(exercise)}
                        disabled={isSaving}
                        style={({ pressed }) => [
                          styles.saveButton,
                          pressed && styles.pressed,
                          isSaving && styles.disabled,
                        ]}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.saveButtonText}>שמור</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <View style={styles.exerciseRow}>
                    <View style={styles.exerciseActions}>
                      <Pressable
                        onPress={() => handleDeleteExercise(exercise)}
                        disabled={isDeleting}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && styles.pressed,
                          isDeleting && styles.disabled,
                        ]}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Text style={styles.deleteButtonText}>מחקי</Text>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleStartEdit(exercise)}
                        style={({ pressed }) => [
                          styles.editButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.editButtonText}>עריכה</Text>
                      </Pressable>
                    </View>

                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{exerciseName}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    gap: 12,
  },
  headerCard: {
    width: "100%",
    backgroundColor: "#17171C",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2B2B31",
    padding: 14,
    gap: 12,
  },
  headerTextWrapOnly: {
    width: "100%",
    alignItems: "flex-end",
    gap: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  subtitle: {
    color: "#B3B3B3",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  countBadge: {
    alignSelf: "flex-end",
    backgroundColor: "#222229",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2B2B31",
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  countBadgeText: {
    color: "#B3B3B3",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  searchBox: {
    width: "100%",
    gap: 8,
  },
  searchLabel: {
    color: "#EDEDED",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  inputWithClearWrap: {
    width: "100%",
    minHeight: 48,
    backgroundColor: "#17171C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B2B31",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  inputWithClearWrapFocused: {
    borderColor: "#FF7A00",
    shadowColor: "#2563EB",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  inputWithClearField: {
    flex: 1,
    minHeight: 46,
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "right",
    writingDirection: "rtl",
    paddingHorizontal: 8,
    paddingVertical: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    includeFontPadding: false,
    ...(Platform.OS === "web"
      ? ({
          outlineWidth: 0,
          outlineStyle: "none",
        } as any)
      : null),
  },
  clearInsideButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222229",
    marginLeft: 4,
    ...(Platform.OS === "web"
      ? ({
          outlineWidth: 0,
          outlineStyle: "none",
          cursor: "pointer",
        } as any)
      : null),
  },
  clearInsideButtonText: {
    color: "#B3B3B3",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center",
    ...(Platform.OS === "web"
      ? ({
          userSelect: "none",
        } as any)
      : null),
  },
  searchResultText: {
    color: "#B3B3B3",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  loadingBox: {
    width: "100%",
    backgroundColor: "#17171C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2B2B31",
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#B3B3B3",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyBox: {
    width: "100%",
    backgroundColor: "#17171C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2B2B31",
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#B3B3B3",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  listContent: {
    gap: 10,
  },
  exerciseCard: {
    width: "100%",
    backgroundColor: "#17171C",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2B2B31",
    padding: 14,
    gap: 12,
  },
  exerciseRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  exerciseName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  exerciseActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  editButton: {
    minWidth: 74,
    backgroundColor: "#2A1A10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF7A00",
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    color: "#FF9A3D",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  deleteButton: {
    minWidth: 74,
    backgroundColor: "#2A1111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7F1D1D",
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  inputLabel: {
    color: "#EDEDED",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  editActionsRow: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: "#059669",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: "#2B2B31",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});