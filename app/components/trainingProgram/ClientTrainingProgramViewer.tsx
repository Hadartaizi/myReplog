import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../../database/firebase";

type ProgramType = "strength" | "running";
type TrainingSplitType = "fullbody" | "ab" | "abc" | "abcd";
type RunningPaceType = "steady" | "intervals";
type RunningManipulationType =
  | "volume"
  | "fartlek"
  | "tempo"
  | "threshold"
  | "intervals"
  | "recovery"
  | "hills";

type ProgramExercise = {
  id?: string;
  name?: string;
  sets?: string;
  reps?: string;
  notes?: string;
};

type ProgramSection = {
  id?: string;
  title?: string;
  exercises?: ProgramExercise[];
};

type RunningWeek = {
  id?: string;
  weekNumber?: number;
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

type RunningProgramSnapshot = {
  id?: string;
  title?: string;
  createdAt?: string;
  archivedAt?: string;
  completedAt?: string;
  runningWeeks?: RunningWeek[];
  runningWeeksCount?: number;
  notes?: string;
};

type StrengthProgramSnapshot = {
  id?: string;
  title?: string;
  createdAt?: string;
  archivedAt?: string;
  completedAt?: string;
  sections?: ProgramSection[];
  notes?: string;
  strengthNotes?: string;
};

type TrainingProgramDoc = {
  sections?: ProgramSection[];
  notes?: string;
  strengthNotes?: string;
  runningNotes?: string;
  updatedAt?: string;
  updatedByName?: string;
  programText?: string;
  splitType?: TrainingSplitType;
  programType?: ProgramType;
  runningWeeks?: RunningWeek[];
  runningWeeksCount?: number;
  activeRunningProgramId?: string;
  runningProgramStartedAt?: string;
  runningProgramHistory?: RunningProgramSnapshot[];
  strengthProgramHistory?: StrengthProgramSnapshot[];
  strengthHistory?: StrengthProgramSnapshot[];
};

function formatDateTime(value?: string) {
  if (!value) return "לא זמין";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "לא זמין";
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSplitTypeLabel(splitType?: TrainingSplitType) {
  switch (splitType) {
    case "fullbody":
      return "פול באדי";
    case "ab":
      return "AB";
    case "abc":
      return "ABC";
    case "abcd":
      return "ABCD";
    default:
      return "לא הוגדר";
  }
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


const isRunningWeekCompleted = (week?: RunningWeek | null) =>
  week?.clientSucceeded === true || week?.clientSucceeded === false;

const getRunningWeekId = (week: Partial<RunningWeek> | undefined, index: number) => {
  const weekNumber = Number(week?.weekNumber || index + 1);
  return String(week?.id || `running-week-${weekNumber}`);
};

const buildNormalizedRunningWeeks = (program?: TrainingProgramDoc | null) => {
  const rawWeeks = Array.isArray(program?.runningWeeks) ? program?.runningWeeks || [] : [];
  const plannedCount = Math.max(Number(program?.runningWeeksCount || 0), rawWeeks.length);

  return Array.from({ length: plannedCount }, (_, index) => {
    const weekNumber = index + 1;
    const existing =
      rawWeeks.find((week) => Number(week?.weekNumber || 0) === weekNumber) ||
      rawWeeks[index] ||
      {};

    return {
      ...existing,
      id: getRunningWeekId(existing, index),
      weekNumber,
    } as RunningWeek;
  });
};

const getWeekId = (week: RunningWeek, index: number) =>
  String(week.id || `running-week-${week.weekNumber || index + 1}`);

const hasRunningWeekContent = (week?: RunningWeek | null) => {
  if (!week) return false;
  return (
    !!String(week.distanceKm || "").trim() ||
    !!String(week.pacePerKm || "").trim() ||
    !!String(week.notes || "").trim() ||
    !!week.paceType ||
    !!week.manipulationType
  );
};

const hasSectionContent = (section?: ProgramSection | null) => {
  if (!section) return false;
  const title = String(section.title || "").trim();
  const exercises = Array.isArray(section.exercises) ? section.exercises : [];
  return (
    !!title ||
    exercises.some(
      (item) =>
        !!String(item?.name || "").trim() ||
        !!String(item?.sets || "").trim() ||
        !!String(item?.reps || "").trim() ||
        !!String(item?.notes || "").trim()
    )
  );
};

const normalizeSectionsForDisplay = (sections?: ProgramSection[] | null) =>
  (Array.isArray(sections) ? sections : [])
    .map((section, sectionIndex) => ({
      ...section,
      id: String(section.id || `section-${sectionIndex}`),
      title: String(section.title || "").trim(),
      exercises: (Array.isArray(section.exercises) ? section.exercises : [])
        .map((exercise, exerciseIndex) => ({
          ...exercise,
          id: String(exercise.id || `exercise-${sectionIndex}-${exerciseIndex}`),
          name: String(exercise.name || "").trim(),
          sets: String(exercise.sets || "").trim(),
          reps: String(exercise.reps || "").trim(),
          notes: String(exercise.notes || "").trim(),
        }))
        .filter(
          (exercise) =>
            !!exercise.name || !!exercise.sets || !!exercise.reps || !!exercise.notes
        ),
    }))
    .filter(hasSectionContent);

const getStrengthHistorySource = (program?: TrainingProgramDoc | null) => {
  const primary = Array.isArray(program?.strengthProgramHistory)
    ? program?.strengthProgramHistory || []
    : [];
  const legacy = Array.isArray(program?.strengthHistory)
    ? program?.strengthHistory || []
    : [];

  return primary.length > 0 ? primary : legacy;
};

export default function ClientTrainingProgramViewer() {
  const [loading, setLoading] = useState(true);
  const [savingWeekId, setSavingWeekId] = useState<string | null>(null);
  const [programData, setProgramData] = useState<TrainingProgramDoc | null>(null);
  const [selectedProgramView, setSelectedProgramView] = useState<ProgramType | null>(null);
  const [openRunningWeekIds, setOpenRunningWeekIds] = useState<Record<string, boolean>>({});
  const [openHistoryProgramIds, setOpenHistoryProgramIds] = useState<Record<string, boolean>>({});
  const [openStrengthSectionIds, setOpenStrengthSectionIds] = useState<Record<string, boolean>>({});

  const loadProgram = useCallback(async () => {
    try {
      setLoading(true);
      const authUser = auth.currentUser;
      if (!authUser?.uid) {
        setProgramData(null);
        return;
      }

      const programSnap = await getDoc(doc(db, "clientTrainingPrograms", authUser.uid));
      setProgramData(programSnap.exists() ? (programSnap.data() as TrainingProgramDoc) : null);
      setOpenRunningWeekIds({});
      setOpenHistoryProgramIds({});
      setOpenStrengthSectionIds({});
    } catch (error) {
      console.error("שגיאה בטעינת תוכנית אימון ללקוח:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את תוכנית האימון");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  const sections = useMemo(
    () => normalizeSectionsForDisplay(programData?.sections),
    [programData]
  );

  const runningWeeks = useMemo(
    () => buildNormalizedRunningWeeks(programData),
    [programData]
  );

  const runningProgramHistory = useMemo(
    () =>
      (Array.isArray(programData?.runningProgramHistory) ? programData.runningProgramHistory : [])
        .map((program, index) => ({
          ...program,
          id: String(program.id || `history-running-program-${index}`),
          runningWeeks: (Array.isArray(program.runningWeeks) ? program.runningWeeks : [])
            .map((week, weekIndex) => ({ ...week, weekNumber: week.weekNumber || weekIndex + 1 }))
            .filter(hasRunningWeekContent)
            .sort((a, b) => Number(a.weekNumber || 0) - Number(b.weekNumber || 0)),
        }))
        .filter((program) => (program.runningWeeks || []).length > 0)
        .sort((a, b) => (new Date(b.archivedAt || b.createdAt || "").getTime() || 0) - (new Date(a.archivedAt || a.createdAt || "").getTime() || 0)),
    [programData]
  );

  const strengthProgramHistory = useMemo(
    () =>
      getStrengthHistorySource(programData)
        .map((program, index) => ({
          ...program,
          id: String(program.id || `history-strength-program-${index}`),
          title: String(program.title || `תוכנית כוח קודמת ${index + 1}`),
          sections: normalizeSectionsForDisplay(program.sections),
        }))
        .filter((program) => (program.sections || []).length > 0)
        .sort(
          (a, b) =>
            (new Date(b.archivedAt || b.createdAt || "").getTime() || 0) -
            (new Date(a.archivedAt || a.createdAt || "").getTime() || 0)
        ),
    [programData]
  );

  const hasStrengthProgram = sections.length > 0 || strengthProgramHistory.length > 0;
  const hasRunningProgram = runningWeeks.length > 0 || runningProgramHistory.length > 0;
  const strengthGeneralNotes = String(programData?.strengthNotes || programData?.notes || programData?.programText || "").trim();
  const runningGeneralNotes = String(programData?.runningNotes || programData?.notes || programData?.programText || "").trim();
  const hasGeneralNotes = !!strengthGeneralNotes || !!runningGeneralNotes;

  const hasProgram = !!programData && (hasStrengthProgram || hasRunningProgram || hasGeneralNotes);

  useEffect(() => {
    if (!programData) {
      setSelectedProgramView(null);
      return;
    }

    if (hasRunningProgram && !hasStrengthProgram) {
      setSelectedProgramView("running");
      return;
    }

    if (hasStrengthProgram && !hasRunningProgram) {
      setSelectedProgramView("strength");
      return;
    }

    setSelectedProgramView(null);
  }, [programData, hasRunningProgram, hasStrengthProgram]);

  const updateLocalRunningWeek = (weekId: string, patch: Partial<RunningWeek>) => {
    setProgramData((prev) => {
      if (!prev) return prev;
      const nextWeeks = buildNormalizedRunningWeeks(prev).map((week, index) => {
        const id = getRunningWeekId(week, index);
        return id === weekId ? { ...week, id, ...patch } : { ...week, id };
      });
      return { ...prev, runningWeeks: nextWeeks, runningWeeksCount: Math.max(Number(prev.runningWeeksCount || 0), nextWeeks.length) };
    });
  };

  const saveRunningWeekFeedback = async (weekId: string) => {
    const authUser = auth.currentUser;
    if (!authUser?.uid || !programData) return;

    try {
      setSavingWeekId(weekId);
      const nowIso = new Date().toISOString();
      const nextWeeks = buildNormalizedRunningWeeks(programData).map((week, index) => {
        const id = getRunningWeekId(week, index);
        return id === weekId ? { ...week, id, clientUpdatedAt: nowIso } : { ...week, id };
      });

      await setDoc(doc(db, "clientTrainingPrograms", authUser.uid), { runningWeeks: nextWeeks, runningWeeksCount: nextWeeks.length }, { merge: true });
      setProgramData((prev) => (prev ? { ...prev, runningWeeks: nextWeeks, runningWeeksCount: nextWeeks.length } : prev));
      Alert.alert("נשמר", "העדכון שלך נשמר למאמן");
    } catch (error) {
      console.error("שגיאה בשמירת עדכון שבוע ריצה:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור את העדכון");
    } finally {
      setSavingWeekId(null);
    }
  };

  const toggleRunningWeek = (weekId: string) => {
    setOpenRunningWeekIds((prev) => ({ ...prev, [weekId]: !prev[weekId] }));
  };

  const toggleHistoryProgram = (programId: string) => {
    setOpenHistoryProgramIds((prev) => ({ ...prev, [programId]: !prev[programId] }));
  };

  const toggleStrengthSection = (sectionId: string) => {
    setOpenStrengthSectionIds((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>תוכנית אימון</Text>
        <Text style={styles.subtitle}>כאן אפשר לראות את כל השבועות והחלקים בתוכנית. כל שבוע סגור, ולחיצה פותחת את הפרטים.</Text>
      </View>

      <Pressable onPress={loadProgram} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
        <Text style={styles.refreshButtonText}>רענון</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={styles.loaderText}>טוען תוכנית אימון...</Text>
        </View>
      ) : !hasProgram ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>עדיין לא נוספה לך תוכנית אימון</Text>
          <Text style={styles.emptyText}>כשהמאמן יוסיף תוכנית היא תופיע כאן.</Text>
        </View>
      ) : !selectedProgramView && hasStrengthProgram && hasRunningProgram ? (
        <View style={styles.choiceBox}>
          <Text style={styles.choiceTitle}>איזו תוכנית להציג?</Text>
          <Pressable onPress={() => setSelectedProgramView("strength")} style={({ pressed }) => [styles.choiceButton, pressed && styles.pressed]}>
            <Text style={styles.choiceButtonText}>אימון כוח</Text>
          </Pressable>
          <Pressable onPress={() => setSelectedProgramView("running")} style={({ pressed }) => [styles.choiceButton, pressed && styles.pressed]}>
            <Text style={styles.choiceButtonText}>אימון ריצה</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.programCard}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>עודכן לאחרונה</Text>
            <Text style={styles.metaValue}>{formatDateTime(programData?.updatedAt)}</Text>
            {!!programData?.updatedByName && <Text style={styles.metaValue}>עודכן על ידי: {programData.updatedByName}</Text>}
            {selectedProgramView === "strength" && <Text style={styles.metaValue}>חלוקה: {getSplitTypeLabel(programData?.splitType)}</Text>}
          </View>

          <ScrollView style={styles.programScroll} contentContainerStyle={styles.programScrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {selectedProgramView === "running" ? (
              runningWeeks.length > 0 || runningProgramHistory.length > 0 ? (
                <View style={styles.runningProgramsWrap}>
                  {runningWeeks.length > 0 && (
                    <View style={styles.activeProgramBox}>
                      <Text style={styles.historyProgramTitle}>תוכנית ריצה פעילה</Text>
                      {runningWeeks.map((week, index) => {
                  const weekId = getRunningWeekId(week, index);
                  const isOpen = !!openRunningWeekIds[weekId];
                  const distanceKm = String(week.distanceKm || "").trim();
                  const pacePerKm = String(week.pacePerKm || "").trim();
                  const notes = String(week.notes || "").trim();
                  const coachFeedback = String(week.coachFeedback || "").trim();
                  const statusLabel =
                    week.clientSucceeded === true
                      ? "בוצע בהצלחה"
                      : week.clientSucceeded === false
                        ? "דווח שלא בוצע בהצלחה"
                        : "טרם דווח ביצוע";

                  return (
                    <View key={weekId} style={styles.runningWeekCard}>
                      <Pressable onPress={() => toggleRunningWeek(weekId)} style={({ pressed }) => [styles.collapsedHeader, pressed && styles.pressed]}>
                        <View style={styles.collapsedHeaderTextWrap}>
                          <Text style={styles.sectionTitle}>שבוע {week.weekNumber || index + 1}</Text>
                          <Text style={styles.weekStatusText}>{statusLabel}</Text>
                          {!!String(week.clientNotes || "").trim() && (
                            <Text style={styles.weekClientNotesPreview} numberOfLines={2}>דיווח: {String(week.clientNotes || "").trim()}</Text>
                          )}
                          {!!week.clientUpdatedAt && <Text style={styles.weekUpdatedPreview}>עודכן: {formatDateTime(week.clientUpdatedAt)}</Text>}
                        </View>
                        <Text style={styles.expandText}>{isOpen ? "סגירה" : "פתיחה"}</Text>
                      </Pressable>

                      {isOpen && (
                        <View style={styles.openContent}>
                          <View style={styles.exerciseStatsRow}>
                            <View style={styles.statBox}>
                              <Text style={styles.statLabel}>מרחק</Text>
                              <Text style={styles.statValue}>{distanceKm ? `${distanceKm} ק״מ` : "-"}</Text>
                            </View>
                            <View style={styles.statBox}>
                              <Text style={styles.statLabel}>זמן לק״מ</Text>
                              <Text style={styles.statValue}>{pacePerKm || "-"}</Text>
                            </View>
                          </View>

                          <View style={styles.exerciseStatsRow}>
                            <View style={styles.statBox}>
                              <Text style={styles.statLabel}>צורת ריצה</Text>
                              <Text style={styles.statValueSmall}>{getPaceTypeLabel(week.paceType)}</Text>
                            </View>
                            <View style={styles.statBox}>
                              <Text style={styles.statLabel}>מניפולציה</Text>
                              <Text style={styles.statValueSmall}>{getManipulationLabel(week.manipulationType)}</Text>
                            </View>
                          </View>

                          {!!notes && <Text style={styles.exerciseNotes}>{notes}</Text>}

                          {!!coachFeedback && (
                            <View style={styles.coachFeedbackBox}>
                              <Text style={styles.coachFeedbackTitle}>משוב מהמאמן</Text>
                              <Text style={styles.coachFeedbackText}>{coachFeedback}</Text>
                            </View>
                          )}

                          <View style={styles.feedbackBox}>
                            <Text style={styles.feedbackTitle}>איך היה השבוע?</Text>
                            <View style={styles.feedbackButtonsRow}>
                              <Pressable onPress={() => updateLocalRunningWeek(weekId, { clientSucceeded: true })} style={({ pressed }) => [styles.feedbackButton, week.clientSucceeded === true && styles.feedbackButtonSuccess, pressed && styles.pressed]}>
                                <Text style={[styles.feedbackButtonText, week.clientSucceeded === true && styles.feedbackButtonTextActive]}>הצלחתי</Text>
                              </Pressable>
                              <Pressable onPress={() => updateLocalRunningWeek(weekId, { clientSucceeded: false })} style={({ pressed }) => [styles.feedbackButton, week.clientSucceeded === false && styles.feedbackButtonFail, pressed && styles.pressed]}>
                                <Text style={[styles.feedbackButtonText, week.clientSucceeded === false && styles.feedbackButtonTextActive]}>לא הצלחתי</Text>
                              </Pressable>
                            </View>
                            <TextInput
                              value={String(week.clientNotes || "")}
                              onChangeText={(value) => updateLocalRunningWeek(weekId, { clientNotes: value })}
                              placeholder="הערות למאמן על השבוע הזה"
                              placeholderTextColor="#94A3B8"
                              style={styles.clientNotesInput}
                              textAlign="right"
                              multiline
                            />
                            <Pressable onPress={() => saveRunningWeekFeedback(weekId)} disabled={savingWeekId === weekId} style={({ pressed }) => [styles.saveFeedbackButton, pressed && styles.pressed, savingWeekId === weekId && styles.disabledButton]}>
                              {savingWeekId === weekId ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveFeedbackButtonText}>שמירת עדכון לשבוע</Text>}
                            </Pressable>
                            {!!week.clientUpdatedAt && <Text style={styles.savedAtText}>עודכן לאחרונה: {formatDateTime(week.clientUpdatedAt)}</Text>}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
                    </View>
                  )}

                  {runningProgramHistory.length > 0 && (
                    <View style={styles.historyProgramsBox}>
                      <Text style={styles.historyProgramsHeading}>היסטוריית תוכניות ריצה</Text>
                      {runningProgramHistory.map((program, programIndex) => {
                        const programId = String(program.id || `history-${programIndex}`);
                        const isProgramOpen = !!openHistoryProgramIds[programId];
                        return (
                          <View key={programId} style={styles.historyProgramCard}>
                            <Pressable onPress={() => toggleHistoryProgram(programId)} style={({ pressed }) => [styles.historyProgramHeader, pressed && styles.pressed]}>
                              <View style={styles.collapsedHeaderTextWrap}>
                                <Text style={styles.historyProgramTitle}>{program.title || `תוכנית ריצה קודמת ${programIndex + 1}`}</Text>
                                <Text style={styles.historyProgramDate}>תאריך: {formatDateTime(program.archivedAt || program.createdAt)}</Text>
                              </View>
                              <Text style={styles.expandText}>{isProgramOpen ? "סגירה" : "פתיחה"}</Text>
                            </Pressable>

                            {isProgramOpen && (program.runningWeeks || []).map((week, weekIndex) => {
                              const weekId = `history-${program.id}-${getWeekId(week, weekIndex)}`;
                              const isOpen = !!openRunningWeekIds[weekId];
                              const distanceKm = String(week.distanceKm || "").trim();
                              const pacePerKm = String(week.pacePerKm || "").trim();
                              const notes = String(week.notes || "").trim();
                              const coachFeedback = String(week.coachFeedback || "").trim();
                              const statusLabel = week.clientSucceeded === true ? "בוצע בהצלחה" : week.clientSucceeded === false ? "דווח שלא בוצע בהצלחה" : "לא דווח";
                              return (
                                <View key={weekId} style={styles.runningWeekCard}>
                                  <Pressable onPress={() => toggleRunningWeek(weekId)} style={({ pressed }) => [styles.collapsedHeader, pressed && styles.pressed]}>
                                    <View style={styles.collapsedHeaderTextWrap}>
                                      <Text style={styles.sectionTitle}>שבוע {week.weekNumber || weekIndex + 1}</Text>
                                      <Text style={styles.weekStatusText}>{statusLabel}</Text>
                                    </View>
                                    <Text style={styles.expandText}>{isOpen ? "סגירה" : "פתיחה"}</Text>
                                  </Pressable>
                                  {isOpen && (
                                    <View style={styles.openContent}>
                                      <View style={styles.exerciseStatsRow}>
                                        <View style={styles.statBox}><Text style={styles.statLabel}>מרחק</Text><Text style={styles.statValue}>{distanceKm ? `${distanceKm} ק״מ` : "-"}</Text></View>
                                        <View style={styles.statBox}><Text style={styles.statLabel}>זמן לק״מ</Text><Text style={styles.statValue}>{pacePerKm || "-"}</Text></View>
                                      </View>
                                      <View style={styles.exerciseStatsRow}>
                                        <View style={styles.statBox}><Text style={styles.statLabel}>צורת ריצה</Text><Text style={styles.statValueSmall}>{getPaceTypeLabel(week.paceType)}</Text></View>
                                        <View style={styles.statBox}><Text style={styles.statLabel}>מניפולציה</Text><Text style={styles.statValueSmall}>{getManipulationLabel(week.manipulationType)}</Text></View>
                                      </View>
                                      {!!notes && <Text style={styles.exerciseNotes}>{notes}</Text>}
                                      {!!coachFeedback && <View style={styles.coachFeedbackBox}><Text style={styles.coachFeedbackTitle}>משוב מהמאמן</Text><Text style={styles.coachFeedbackText}>{coachFeedback}</Text></View>}
                                      {!!week.clientNotes && <View style={styles.readOnlyClientNotesBox}><Text style={styles.feedbackTitle}>הדיווח שלך</Text><Text style={styles.exerciseNotes}>{week.clientNotes}</Text></View>}
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.emptyText}>לא נמצאה תוכנית ריצה</Text>
              )
            ) : sections.length > 0 || strengthProgramHistory.length > 0 ? (
              <View style={styles.runningProgramsWrap}>
                {sections.length > 0 && (
                  <View style={styles.activeProgramBox}>
                    <Text style={styles.historyProgramTitle}>תוכנית כוח פעילה</Text>
                    {sections.map((section, sectionIndex) => {
                      const sectionId = String(section.id || `section-${sectionIndex}`);
                      const isOpen = !!openStrengthSectionIds[sectionId];
                      const exercises = Array.isArray(section.exercises) ? section.exercises : [];
                      return (
                        <View key={sectionId} style={styles.sectionCard}>
                          <Pressable onPress={() => toggleStrengthSection(sectionId)} style={({ pressed }) => [styles.collapsedHeader, pressed && styles.pressed]}>
                            <View style={styles.collapsedHeaderTextWrap}>
                              <Text style={styles.sectionTitle}>{section.title || `חלק ${sectionIndex + 1}`}</Text>
                              <Text style={styles.weekStatusText}>{exercises.length} תרגילים</Text>
                            </View>
                            <Text style={styles.expandText}>{isOpen ? "סגירה" : "פתיחה"}</Text>
                          </Pressable>

                          {isOpen && (
                            <View style={styles.openContent}>
                              {exercises.map((exercise, exerciseIndex) => {
                                const exerciseName = String(exercise?.name || "").trim();
                                const sets = String(exercise?.sets || "").trim();
                                const reps = String(exercise?.reps || "").trim();
                                const notes = String(exercise?.notes || "").trim();
                                if (!exerciseName && !sets && !reps && !notes) return null;
                                return (
                                  <View key={exercise.id || `${exerciseName}-${exerciseIndex}`} style={styles.exerciseRow}>
                                    <Text style={styles.exerciseName}>{exerciseName || `תרגיל ${exerciseIndex + 1}`}</Text>
                                    <View style={styles.exerciseStatsRow}>
                                      <View style={styles.statBox}>
                                        <Text style={styles.statLabel}>סטים</Text>
                                        <Text style={styles.statValue}>{sets || "-"}</Text>
                                      </View>
                                      <View style={styles.statBox}>
                                        <Text style={styles.statLabel}>חזרות</Text>
                                        <Text style={styles.statValue}>{reps || "-"}</Text>
                                      </View>
                                    </View>
                                    {!!notes && <Text style={styles.exerciseNotes}>{notes}</Text>}
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {strengthProgramHistory.length > 0 && (
                  <View style={styles.historyProgramsBox}>
                    <Text style={styles.historyProgramsHeading}>היסטוריית תוכניות כוח</Text>
                    {strengthProgramHistory.map((program, programIndex) => {
                      const programId = String(program.id || `history-strength-${programIndex}`);
                      const isProgramOpen = !!openHistoryProgramIds[programId];
                      const historyNotes = String(program.strengthNotes || program.notes || "").trim();

                      return (
                        <View key={programId} style={styles.historyProgramCard}>
                          <Pressable onPress={() => toggleHistoryProgram(programId)} style={({ pressed }) => [styles.historyProgramHeader, pressed && styles.pressed]}>
                            <View style={styles.collapsedHeaderTextWrap}>
                              <Text style={styles.historyProgramTitle}>{program.title || `תוכנית כוח קודמת ${programIndex + 1}`}</Text>
                              <Text style={styles.historyProgramDate}>תאריך: {formatDateTime(program.archivedAt || program.createdAt)}</Text>
                            </View>
                            <Text style={styles.expandText}>{isProgramOpen ? "סגירה" : "פתיחה"}</Text>
                          </Pressable>

                          {isProgramOpen && (
                            <View style={styles.openContent}>
                              {(program.sections || []).map((section, sectionIndex) => {
                                const sectionId = String(section.id || `${programId}-section-${sectionIndex}`);
                                const exercises = Array.isArray(section.exercises) ? section.exercises : [];

                                return (
                                  <View key={sectionId} style={styles.sectionCard}>
                                    <Text style={styles.sectionTitle}>{section.title || `חלק ${sectionIndex + 1}`}</Text>
                                    <Text style={styles.weekStatusText}>{exercises.length} תרגילים</Text>

                                    <View style={styles.openContent}>
                                      {exercises.map((exercise, exerciseIndex) => {
                                        const exerciseName = String(exercise?.name || "").trim();
                                        const sets = String(exercise?.sets || "").trim();
                                        const reps = String(exercise?.reps || "").trim();
                                        const notes = String(exercise?.notes || "").trim();
                                        if (!exerciseName && !sets && !reps && !notes) return null;
                                        return (
                                          <View key={exercise.id || `${programId}-${sectionIndex}-${exerciseIndex}`} style={styles.exerciseRow}>
                                            <Text style={styles.exerciseName}>{exerciseName || `תרגיל ${exerciseIndex + 1}`}</Text>
                                            <View style={styles.exerciseStatsRow}>
                                              <View style={styles.statBox}>
                                                <Text style={styles.statLabel}>סטים</Text>
                                                <Text style={styles.statValue}>{sets || "-"}</Text>
                                              </View>
                                              <View style={styles.statBox}>
                                                <Text style={styles.statLabel}>חזרות</Text>
                                                <Text style={styles.statValue}>{reps || "-"}</Text>
                                              </View>
                                            </View>
                                            {!!notes && <Text style={styles.exerciseNotes}>{notes}</Text>}
                                          </View>
                                        );
                                      })}
                                    </View>
                                  </View>
                                );
                              })}

                              {!!historyNotes && (
                                <View style={styles.notesBox}>
                                  <Text style={styles.notesTitle}>הערות כלליות לתוכנית</Text>
                                  <Text style={styles.notesText}>{historyNotes}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>לא נמצאה תוכנית כוח</Text>
            )}

            {selectedProgramView === "strength" && !!strengthGeneralNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>הערות כלליות לכוח</Text>
                <Text style={styles.notesText}>{strengthGeneralNotes}</Text>
              </View>
            )}
            {selectedProgramView === "running" && !!runningGeneralNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>הערות כלליות לריצה</Text>
                <Text style={styles.notesText}>{runningGeneralNotes}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: 12 },
  headerBox: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, alignItems: "flex-end", gap: 4 },
  title: { color: "#0F172A", fontSize: 18, fontWeight: "800", textAlign: "right" },
  subtitle: { color: "#64748B", fontSize: 13, lineHeight: 20, textAlign: "right" },
  refreshButton: { minHeight: 46, backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  refreshButtonText: { color: "#0F172A", fontSize: 14, fontWeight: "800", textAlign: "center" },
  loaderWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 10 },
  loaderText: { color: "#64748B", fontSize: 14, textAlign: "center" },
  emptyBox: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", paddingVertical: 24, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800", textAlign: "center" },
  emptyText: { color: "#64748B", fontSize: 14, textAlign: "center", lineHeight: 22 },
  choiceBox: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, gap: 10 },
  choiceTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800", textAlign: "center" },
  choiceButton: { minHeight: 50, borderRadius: 16, backgroundColor: "#E0F2FE", borderWidth: 1, borderColor: "#BAE6FD", alignItems: "center", justifyContent: "center" },
  choiceButtonText: { color: "#0C4A6E", fontSize: 15, fontWeight: "900", textAlign: "center" },
  programCard: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, gap: 12 },
  metaBox: { backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, alignItems: "flex-end", gap: 4 },
  metaLabel: { color: "#64748B", fontSize: 12, fontWeight: "700", textAlign: "right" },
  metaValue: { color: "#0F172A", fontSize: 14, fontWeight: "700", textAlign: "right" },
  programScroll: { maxHeight: 620 },
  programScrollContent: { gap: 12, paddingBottom: 10 },
  sectionCard: { backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, gap: 10 },
  runningProgramsWrap: { gap: 14 },
  activeProgramBox: { gap: 10 },
  historyProgramsBox: { gap: 12, marginTop: 8 },
  historyProgramsHeading: { color: "#0F172A", fontSize: 17, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  historyProgramCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 18, padding: 12, gap: 10 },
  historyProgramHeader: { width: "100%", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 14 },
  historyProgramTitle: { color: "#0F172A", fontSize: 15, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  historyProgramDate: { color: "#64748B", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  readOnlyClientNotesBox: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, padding: 12, gap: 6 },
  runningWeekCard: { backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, gap: 10 },
  collapsedHeader: { width: "100%", minHeight: 54, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  collapsedHeaderTextWrap: { flex: 1, alignItems: "flex-end", gap: 4 },
  expandText: { color: "#2563EB", fontSize: 13, fontWeight: "900", textAlign: "left" },
  openContent: { gap: 10, paddingTop: 4 },
  sectionTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800", textAlign: "right" },
  weekStatusText: { color: "#64748B", fontSize: 12, fontWeight: "700", textAlign: "right" },
  weekClientNotesPreview: { color: "#334155", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 4 },
  weekUpdatedPreview: { color: "#64748B", fontSize: 11, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 2 },
  exerciseRow: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 10, gap: 8 },
  exerciseName: { color: "#0F172A", fontSize: 15, fontWeight: "800", textAlign: "right" },
  exerciseStatsRow: { flexDirection: "row-reverse", gap: 8 },
  statBox: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 10, alignItems: "center", justifyContent: "center", minHeight: 68 },
  statLabel: { color: "#64748B", fontSize: 12, fontWeight: "700", textAlign: "center" },
  statValue: { color: "#0F172A", fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 4 },
  statValueSmall: { color: "#0F172A", fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 4, lineHeight: 18 },
  exerciseNotes: { color: "#475569", fontSize: 13, lineHeight: 20, textAlign: "right", backgroundColor: "#F8FAFC", borderRadius: 12, padding: 10 },
  notesBox: { backgroundColor: "#EFF6FF", borderRadius: 14, borderWidth: 1, borderColor: "#BFDBFE", padding: 12, gap: 6 },
  notesTitle: { color: "#1D4ED8", fontSize: 14, fontWeight: "800", textAlign: "right" },
  notesText: { color: "#0F172A", fontSize: 14, lineHeight: 22, textAlign: "right" },
  coachFeedbackBox: { backgroundColor: "#FFFBEB", borderRadius: 14, borderWidth: 1, borderColor: "#FDE68A", padding: 10, gap: 5 },
  coachFeedbackTitle: { color: "#92400E", fontSize: 13, fontWeight: "900", textAlign: "right" },
  coachFeedbackText: { color: "#78350F", fontSize: 13, lineHeight: 20, fontWeight: "700", textAlign: "right" },
  feedbackBox: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 10, gap: 9 },
  feedbackTitle: { color: "#0F172A", fontSize: 14, fontWeight: "800", textAlign: "right" },
  feedbackButtonsRow: { flexDirection: "row-reverse", gap: 8 },
  feedbackButton: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  feedbackButtonSuccess: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  feedbackButtonFail: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  feedbackButtonText: { color: "#334155", fontSize: 13, fontWeight: "800", textAlign: "center" },
  feedbackButtonTextActive: { color: "#FFFFFF" },
  clientNotesInput: { width: "100%", minHeight: 88, backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: "#CBD5E1", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#0F172A", writingDirection: "rtl", textAlignVertical: "top" },
  saveFeedbackButton: { minHeight: 46, backgroundColor: "#2563EB", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveFeedbackButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", textAlign: "center" },
  savedAtText: { color: "#64748B", fontSize: 12, fontWeight: "600", textAlign: "right" },
  pressed: { opacity: 0.8 },
  disabledButton: { opacity: 0.6 },
});
