import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../../database/firebase";

type UserRole = "owner" | "admin" | "client";

type ClientItem = {
  id: string;
  uid?: string;
  authUid?: string | null;
  name?: string;
  email?: string;
  role?: UserRole;
};

type CurrentUserData = {
  name?: string;
  email?: string;
  role?: UserRole;
  uid?: string | null;
  authUid?: string | null;
};

type Props = {
  clients: ClientItem[];
  currentUserData?: CurrentUserData | null;
  onAfterSave?: () => void | Promise<void>;
};

type ProgramExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  notes: string;
};

type ProgramSection = {
  id: string;
  title: string;
  exercises: ProgramExercise[];
};

type TrainingSplitType = "fullbody" | "ab" | "abc" | "abcd";

type TrainingProgramDoc = {
  clientUid: string;
  clientDocId?: string;
  clientName?: string;
  clientEmail?: string;
  clientRole?: UserRole | "self";
  splitType?: TrainingSplitType;
  sections: ProgramSection[];
  notes?: string;
  exerciseHistory?: string[];
  updatedAt: string;
  updatedByUid: string;
  updatedByName?: string;
  updatedByRole?: string;
};

function getClientResolvedUid(client: ClientItem) {
  return String(client.authUid || client.uid || client.id || "").trim();
}

function createExercise(): ProgramExercise {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    sets: "",
    reps: "",
    notes: "",
  };
}

function createSection(title = ""): ProgramSection {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    exercises: [createExercise()],
  };
}

function getSectionsBySplit(splitType: TrainingSplitType): ProgramSection[] {
  if (splitType === "fullbody") {
    return [createSection("פול באדי")];
  }

  if (splitType === "ab") {
    return [createSection("אימון A"), createSection("אימון B")];
  }

  if (splitType === "abc") {
    return [
      createSection("אימון A"),
      createSection("אימון B"),
      createSection("אימון C"),
    ];
  }

  return [
    createSection("אימון A"),
    createSection("אימון B"),
    createSection("אימון C"),
    createSection("אימון D"),
  ];
}

function normalizeExerciseName(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/\s+/g, " ");
}

function getExerciseNamesFromSections(sections: ProgramSection[]) {
  return sections
    .flatMap((section) => section.exercises || [])
    .map((exercise) => String(exercise.name || "").trim())
    .filter(Boolean);
}

function mergeExerciseHistory(...groups: Array<Array<string | undefined | null> | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  groups.forEach((group) => {
    (group || []).forEach((name) => {
      const cleanName = String(name || "").trim();
      const normalized = normalizeExerciseName(cleanName);

      if (!cleanName || !normalized || seen.has(normalized)) return;

      seen.add(normalized);
      result.push(cleanName);
    });
  });

  return result.sort((a, b) => a.localeCompare(b, "he"));
}

function hasMeaningfulContent(sections: ProgramSection[], notes: string) {
  const hasSectionContent = sections.some(
    (section) =>
      section.title.trim() ||
      section.exercises.some(
        (exercise) =>
          exercise.name.trim() ||
          exercise.sets.trim() ||
          exercise.reps.trim() ||
          exercise.notes.trim()
      )
  );

  return hasSectionContent || notes.trim().length > 0;
}

function SplitTypeButtons({
  value,
  onChange,
}: {
  value: TrainingSplitType;
  onChange: (next: TrainingSplitType) => void;
}) {
  return (
    <View style={styles.splitButtonsWrap}>
      <View style={styles.splitButtonsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChange("fullbody")}
          style={[
            styles.splitButton,
            value === "fullbody" && styles.splitButtonActive,
          ]}
        >
          <Text
            style={[
              styles.splitButtonText,
              value === "fullbody" && styles.splitButtonTextActive,
            ]}
          >
            פול באדי
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChange("ab")}
          style={[
            styles.splitButton,
            value === "ab" && styles.splitButtonActive,
          ]}
        >
          <Text
            style={[
              styles.splitButtonText,
              value === "ab" && styles.splitButtonTextActive,
            ]}
          >
            AB
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.splitButtonsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChange("abc")}
          style={[
            styles.splitButton,
            value === "abc" && styles.splitButtonActive,
          ]}
        >
          <Text
            style={[
              styles.splitButtonText,
              value === "abc" && styles.splitButtonTextActive,
            ]}
          >
            ABC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChange("abcd")}
          style={[
            styles.splitButton,
            value === "abcd" && styles.splitButtonActive,
          ]}
        >
          <Text
            style={[
              styles.splitButtonText,
              value === "abcd" && styles.splitButtonTextActive,
            ]}
          >
            ABCD
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ClientTrainingProgramManager({
  clients,
  currentUserData,
  onAfterSave,
}: Props) {
  const authUser = auth.currentUser;

  const selfItem = useMemo<ClientItem | null>(() => {
    const selfUid = String(authUser?.uid || "").trim();
    if (!selfUid) return null;

    return {
      id: selfUid,
      uid: selfUid,
      authUid: selfUid,
      role: currentUserData?.role,
      name: currentUserData?.name ? `${currentUserData.name} (אני)` : "אני",
      email: currentUserData?.email || "",
    };
  }, [
    authUser?.uid,
    currentUserData?.email,
    currentUserData?.name,
    currentUserData?.role,
  ]);

  const selectablePeople = useMemo(() => {
    const merged = [...clients];

    if (selfItem) {
      const selfUid = getClientResolvedUid(selfItem);
      const alreadyExists = merged.some(
        (item) => getClientResolvedUid(item) === selfUid
      );

      if (!alreadyExists) {
        merged.unshift(selfItem);
      }
    }

    return merged.sort((a, b) => {
      const aIsSelf =
        !!selfItem && getClientResolvedUid(a) === getClientResolvedUid(selfItem);
      const bIsSelf =
        !!selfItem && getClientResolvedUid(b) === getClientResolvedUid(selfItem);

      if (aIsSelf) return -1;
      if (bIsSelf) return 1;

      return String(a.name || "").localeCompare(String(b.name || ""), "he");
    });
  }, [clients, selfItem]);

  const [selectedClientUid, setSelectedClientUid] = useState("");
  const [sections, setSections] = useState<ProgramSection[]>([]);
  const [notes, setNotes] = useState("");
  const [splitType, setSplitType] = useState<TrainingSplitType>("fullbody");
  const [exerciseHistory, setExerciseHistory] = useState<string[]>([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ sectionId: string; exerciseId: string } | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);

  const selectedClient = useMemo(() => {
    return selectablePeople.find(
      (client) => getClientResolvedUid(client) === selectedClientUid
    );
  }, [selectablePeople, selectedClientUid]);

  useEffect(() => {
    if (!selectedClientUid) {
      setSections([]);
      setNotes("");
      setSplitType("fullbody");
      setExerciseHistory([]);
      return;
    }

    let isMounted = true;

    const loadProgram = async () => {
      try {
        setLoadingProgram(true);

        const programRef = doc(db, "clientTrainingPrograms", selectedClientUid);
        const programSnap = await getDoc(programRef);

        if (!isMounted) return;

        if (programSnap.exists()) {
          const data = programSnap.data() as Partial<TrainingProgramDoc> & {
            programText?: string;
          };

          const savedSplitType: TrainingSplitType =
            data.splitType === "ab" ||
            data.splitType === "abc" ||
            data.splitType === "abcd" ||
            data.splitType === "fullbody"
              ? data.splitType
              : "fullbody";

          const nextSections = Array.isArray(data.sections) ? data.sections : [];

          setSplitType(savedSplitType);
          setSections(
            nextSections.length > 0 ? nextSections : getSectionsBySplit(savedSplitType)
          );
          setNotes(String(data.notes || data.programText || ""));
          setExerciseHistory(
            mergeExerciseHistory(
              Array.isArray(data.exerciseHistory) ? data.exerciseHistory : [],
              getExerciseNamesFromSections(nextSections)
            )
          );
        } else {
          setSplitType("fullbody");
          setSections(getSectionsBySplit("fullbody"));
          setNotes("");
          setExerciseHistory([]);
        }
      } catch (error) {
        console.error("שגיאה בטעינת תוכנית אימון:", error);
        if (isMounted) {
          Alert.alert("שגיאה", "לא ניתן לטעון את תוכנית האימון");
        }
      } finally {
        if (isMounted) {
          setLoadingProgram(false);
        }
      }
    };

    loadProgram();

    return () => {
      isMounted = false;
    };
  }, [selectedClientUid]);

  const applySplitTemplate = (nextSplitType: TrainingSplitType) => {
    if (nextSplitType === splitType) return;

    const replaceTemplate = () => {
      setSplitType(nextSplitType);
      setSections(getSectionsBySplit(nextSplitType));
    };

    if (!hasMeaningfulContent(sections, notes)) {
      replaceTemplate();
      return;
    }

    replaceTemplate();
  };

  const updateSectionTitle = (sectionId: string, value: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, title: value } : section
      )
    );
  };

  const updateExerciseField = (
    sectionId: string,
    exerciseId: string,
    field: keyof Omit<ProgramExercise, "id">,
    value: string
  ) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              exercises: section.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? { ...exercise, [field]: value }
                  : exercise
              ),
            }
      )
    );
  };


  const filteredExerciseHistory = useMemo(() => {
    const search = normalizeExerciseName(historySearch);
    if (!search) return exerciseHistory;

    return exerciseHistory.filter((name) =>
      normalizeExerciseName(name).includes(search)
    );
  }, [exerciseHistory, historySearch]);

  const openExerciseHistory = (sectionId: string, exerciseId: string) => {
    setHistoryTarget({ sectionId, exerciseId });
    setHistorySearch("");
    setHistoryModalVisible(true);
  };

  const closeExerciseHistory = () => {
    setHistoryModalVisible(false);
    setHistoryTarget(null);
    setHistorySearch("");
  };

  const selectExerciseFromHistory = (exerciseName: string) => {
    if (!historyTarget) return;

    updateExerciseField(
      historyTarget.sectionId,
      historyTarget.exerciseId,
      "name",
      exerciseName
    );

    closeExerciseHistory();
  };

  const addSection = () => {
    setSections((prev) => [...prev, createSection("")]);
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((section) => section.id !== sectionId));
  };

  const addExercise = (sectionId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, exercises: [...section.exercises, createExercise()] }
          : section
      )
    );
  };

  const removeExercise = (sectionId: string, exerciseId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              exercises: section.exercises.filter(
                (exercise) => exercise.id !== exerciseId
              ),
            }
      )
    );
  };

  const handleSave = async () => {
    const signedInUser = auth.currentUser;

    if (!signedInUser) {
      Alert.alert("שגיאה", "לא נמצא משתמש מחובר");
      return;
    }

    if (!selectedClient) {
      Alert.alert("שגיאה", "יש לבחור מתאמן או את עצמך");
      return;
    }

    const resolvedClientUid = getClientResolvedUid(selectedClient);

    if (!resolvedClientUid) {
      Alert.alert("שגיאה", "לא נמצא מזהה תקין");
      return;
    }

    const cleanedSections = sections
      .map((section) => ({
        ...section,
        title: section.title.trim(),
        exercises: section.exercises
          .map((exercise) => ({
            ...exercise,
            name: exercise.name.trim(),
            sets: exercise.sets.trim(),
            reps: exercise.reps.trim(),
            notes: exercise.notes.trim(),
          }))
          .filter(
            (exercise) =>
              exercise.name || exercise.sets || exercise.reps || exercise.notes
          ),
      }))
      .filter((section) => section.title || section.exercises.length > 0);

    if (cleanedSections.length === 0 && !notes.trim()) {
      Alert.alert("שגיאה", "יש למלא לפחות כותרת אחת או תרגיל אחד");
      return;
    }

    try {
      setSavingProgram(true);

      const nextExerciseHistory = mergeExerciseHistory(
        exerciseHistory,
        getExerciseNamesFromSections(cleanedSections)
      );

      const payload: TrainingProgramDoc = {
        clientUid: resolvedClientUid,
        clientDocId: selectedClient.id,
        clientName: selectedClient.name || "",
        clientEmail: selectedClient.email || "",
        clientRole:
          selfItem && resolvedClientUid === getClientResolvedUid(selfItem)
            ? "self"
            : selectedClient.role || "client",
        splitType,
        sections: cleanedSections,
        notes: notes.trim(),
        exerciseHistory: nextExerciseHistory,
        updatedAt: new Date().toISOString(),
        updatedByUid: signedInUser.uid,
        updatedByName: currentUserData?.name || "",
        updatedByRole: currentUserData?.role || "",
      };

      await setDoc(doc(db, "clientTrainingPrograms", resolvedClientUid), payload, {
        merge: true,
      });

      setExerciseHistory(nextExerciseHistory);

      if (Platform.OS === "web") {
        window.alert("תוכנית האימון נשמרה בהצלחה");
      } else {
        Alert.alert("הצלחה", "תוכנית האימון נשמרה בהצלחה");
      }

      if (onAfterSave) {
        await onAfterSave();
      }
    } catch (error) {
      console.error("שגיאה בשמירת תוכנית אימון:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור את תוכנית האימון");
    } finally {
      setSavingProgram(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>בניית תוכנית אימון מקצועית</Text>
        <Text style={styles.subtitle}>
          בחירת מתאמן או עצמי, סוג תוכנית, כותרות, תרגילים, סטים, חזרות והערות
        </Text>
      </View>

      {selectablePeople.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>אין לקוחות זמינים להצגה</Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>בחירת מתאמן / עצמי</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.clientsRow}
          >
            {selectablePeople.map((client) => {
              const clientUid = getClientResolvedUid(client);
              const isSelected = clientUid === selectedClientUid;

              return (
                <TouchableOpacity
                  key={`${client.id}-${clientUid}`}
                  activeOpacity={0.85}
                  onPress={() => setSelectedClientUid(clientUid)}
                  style={[
                    styles.clientChip,
                    isSelected && styles.clientChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.clientChipText,
                      isSelected && styles.clientChipTextSelected,
                    ]}
                  >
                    {client.name || client.email || "ללא שם"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedClientUid ? (
            <View style={styles.editorCard}>
              <View style={styles.selectedClientBox}>
                <Text style={styles.selectedClientLabel}>בחירה נוכחית</Text>
                <Text style={styles.selectedClientName}>
                  {selectedClient?.name || "ללא שם"}
                </Text>
                {!!selectedClient?.email && (
                  <Text style={styles.selectedClientEmail}>
                    {selectedClient.email}
                  </Text>
                )}
              </View>

              {loadingProgram ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="small" color="#0F172A" />
                  <Text style={styles.loaderText}>טוען תוכנית קיימת...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.splitBox}>
                    <Text style={styles.label}>סוג התוכנית</Text>
                    <SplitTypeButtons
                      value={splitType}
                      onChange={applySplitTemplate}
                    />
                  </View>

                  {sections.map((section, sectionIndex) => (
                    <View key={section.id} style={styles.sectionCard}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => removeSection(section.id)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonText}>מחיקת כותרת</Text>
                      </TouchableOpacity>

                      <TextInput
                        value={section.title}
                        onChangeText={(value) => updateSectionTitle(section.id, value)}
                        placeholder="כותרת לדוגמה: פול באדי / אימון A / אימון B / אימון C / אימון D"
                        placeholderTextColor="#94A3B8"
                        style={styles.sectionTitleInput}
                        textAlign="right"
                      />

                      {section.exercises.map((exercise, exerciseIndex) => (
                        <View key={exercise.id} style={styles.exerciseCard}>
                          <View style={styles.exerciseHeader}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => removeExercise(section.id, exercise.id)}
                              style={styles.removeSmallButton}
                            >
                              <Text style={styles.removeSmallButtonText}>
                                מחיקת תרגיל
                              </Text>
                            </TouchableOpacity>

                            <Text style={styles.exerciseIndex}>
                              תרגיל {exerciseIndex + 1}
                            </Text>
                          </View>

                          <TextInput
                            value={exercise.name}
                            onChangeText={(value) =>
                              updateExerciseField(section.id, exercise.id, "name", value)
                            }
                            placeholder="שם תרגיל"
                            placeholderTextColor="#94A3B8"
                            style={styles.input}
                            textAlign="right"
                          />

                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => openExerciseHistory(section.id, exercise.id)}
                            style={styles.historyButton}
                          >
                            <Text style={styles.historyButtonText}>
                              היסטוריית תרגילים
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.rowInputs}>
                            <TextInput
                              value={exercise.sets}
                              onChangeText={(value) =>
                                updateExerciseField(section.id, exercise.id, "sets", value)
                              }
                              placeholder="סטים"
                              placeholderTextColor="#94A3B8"
                              style={styles.halfInput}
                              textAlign="right"
                              keyboardType="numeric"
                            />

                            <TextInput
                              value={exercise.reps}
                              onChangeText={(value) =>
                                updateExerciseField(section.id, exercise.id, "reps", value)
                              }
                              placeholder="חזרות"
                              placeholderTextColor="#94A3B8"
                              style={styles.halfInput}
                              textAlign="right"
                              keyboardType="numeric"
                            />
                          </View>

                          <TextInput
                            value={exercise.notes}
                            onChangeText={(value) =>
                              updateExerciseField(section.id, exercise.id, "notes", value)
                            }
                            placeholder="הערות לתרגיל"
                            placeholderTextColor="#94A3B8"
                            style={styles.input}
                            textAlign="right"
                          />
                        </View>
                      ))}

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => addExercise(section.id)}
                        style={styles.secondaryActionButton}
                      >
                        <Text style={styles.secondaryActionButtonText}>
                          הוספת תרגיל
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={addSection}
                    style={styles.addSectionButton}
                  >
                    <Text style={styles.addSectionButtonText}>הוספת כותרת חדשה</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>הערות כלליות</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="לדוגמה: מנוחה 60 שניות בין סטים, חימום לפני תחילת האימון..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlign="right"
                    style={styles.notesArea}
                  />

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSave}
                    disabled={savingProgram}
                    style={[
                      styles.saveButton,
                      savingProgram && styles.disabled,
                    ]}
                  >
                    {savingProgram ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>שמור תוכנית אימון</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                בחרי מתאמן או את עצמך כדי לבנות תוכנית
              </Text>
            </View>
          )}
        </>
      )}

      <Modal
        visible={historyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeExerciseHistory}
      >
        <View style={styles.historyModalOverlay}>
          <View style={styles.historyModalCard}>
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle}>היסטוריית תרגילים</Text>
              <Text style={styles.historyModalSubtitle}>
                בחרי שם תרגיל שכבר הוזן בעבר כדי לשמור על שם זהה במעקב
              </Text>
            </View>

            <TextInput
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholder="חיפוש תרגיל"
              placeholderTextColor="#94A3B8"
              style={styles.historySearchInput}
              textAlign="right"
            />

            {exerciseHistory.length === 0 ? (
              <View style={styles.historyEmptyBox}>
                <Text style={styles.historyEmptyText}>
                  עדיין אין תרגילים בהיסטוריה ללקוח הזה
                </Text>
              </View>
            ) : filteredExerciseHistory.length === 0 ? (
              <View style={styles.historyEmptyBox}>
                <Text style={styles.historyEmptyText}>לא נמצאו תרגילים בחיפוש</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.historyList}
                contentContainerStyle={styles.historyListContent}
                keyboardShouldPersistTaps="handled"
              >
                {filteredExerciseHistory.map((name) => (
                  <TouchableOpacity
                    key={normalizeExerciseName(name)}
                    activeOpacity={0.85}
                    onPress={() => selectExerciseFromHistory(name)}
                    style={styles.historyItem}
                  >
                    <Text style={styles.historyItemText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={closeExerciseHistory}
              style={styles.historyCloseButton}
            >
              <Text style={styles.historyCloseButtonText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  headerBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    alignItems: "flex-end",
    gap: 4,
  },
  title: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  clientsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingVertical: 4,
  },
  clientChip: {
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  clientChipSelected: {
    backgroundColor: "#E0E7FF",
    borderColor: "#A5B4FC",
  },
  clientChipText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  clientChipTextSelected: {
    color: "#312E81",
  },
  editorCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
    overflow: "visible",
  },
  selectedClientBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    alignItems: "flex-end",
    gap: 3,
  },
  selectedClientLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  selectedClientName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  selectedClientEmail: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "right",
  },
  splitBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
    position: "relative",
    zIndex: 20,
    elevation: 20,
  },
  splitButtonsWrap: {
    width: "100%",
    gap: 8,
  },
  splitButtonsRow: {
    width: "100%",
    flexDirection: "row-reverse",
    gap: 8,
  },
  splitButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    position: "relative",
    zIndex: 30,
    elevation: 30,
  },
  splitButtonActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1",
  },
  splitButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  splitButtonTextActive: {
    color: "#3730A3",
  },
  sectionCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  sectionTitleInput: {
    width: "100%",
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    textAlign: "right",
    writingDirection: "rtl",
  },
  exerciseCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    gap: 8,
  },
  exerciseHeader: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  exerciseIndex: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  input: {
    width: "100%",
    minHeight: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    textAlign: "right",
    writingDirection: "rtl",
  },
  rowInputs: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  halfInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    textAlign: "right",
    writingDirection: "rtl",
  },
  notesArea: {
    width: "100%",
    minHeight: 120,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0F172A",
    textAlign: "right",
    textAlignVertical: "top",
    writingDirection: "rtl",
  },
  addSectionButton: {
    width: "100%",
    minHeight: 48,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addSectionButtonText: {
    color: "#3730A3",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryActionButton: {
    width: "100%",
    minHeight: 44,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryActionButtonText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  removeButton: {
    alignSelf: "stretch",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  removeSmallButton: {
    backgroundColor: "#FFF1F2",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#FECDD3",
    alignItems: "center",
    justifyContent: "center",
  },
  removeSmallButtonText: {
    color: "#E11D48",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  historyButton: {
    width: "100%",
    minHeight: 42,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  historyButtonText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  historyModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  historyModalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  historyModalHeader: {
    alignItems: "flex-end",
    gap: 4,
  },
  historyModalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  historyModalSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  historySearchInput: {
    width: "100%",
    minHeight: 46,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    textAlign: "right",
    writingDirection: "rtl",
  },
  historyList: {
    maxHeight: 310,
    width: "100%",
  },
  historyListContent: {
    gap: 8,
    paddingVertical: 2,
  },
  historyItem: {
    width: "100%",
    minHeight: 46,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  historyItemText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  historyEmptyBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  historyEmptyText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  historyCloseButton: {
    width: "100%",
    minHeight: 48,
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  historyCloseButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  saveButton: {
    width: "100%",
    minHeight: 52,
    backgroundColor: "#0F172A",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  infoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  infoText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 8,
  },
  loaderText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
  },
  disabled: {
    opacity: 0.6,
  },
});