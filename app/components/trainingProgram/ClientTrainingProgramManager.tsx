import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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

type RunningWeek = {
  id: string;
  weekNumber: number;
  distanceKm: string;
  pacePerKm: string;
  paceType: RunningPaceType;
  manipulationType: RunningManipulationType;
  notes: string;
  clientSucceeded?: boolean | null;
  clientNotes?: string;
  clientUpdatedAt?: string;
  coachFeedback?: string;
  coachFeedbackUpdatedAt?: string;
};

type RunningProgramSnapshot = {
  id: string;
  title?: string;
  createdAt: string;
  archivedAt?: string;
  runningWeeksCount: number;
  runningWeeks: RunningWeek[];
  notes?: string;
  runningNotes?: string;
  completedAt?: string;
};

type TrainingProgramDoc = {
  clientUid: string;
  clientDocId?: string;
  clientName?: string;
  clientEmail?: string;
  clientRole?: UserRole | "self";
  programType?: ProgramType;
  splitType?: TrainingSplitType;
  sections?: ProgramSection[];
  notes?: string;
  strengthNotes?: string;
  runningNotes?: string;
  exerciseHistory?: string[];
  runningWeeksCount?: number;
  runningWeeks?: RunningWeek[];
  activeRunningProgramId?: string;
  runningProgramStartedAt?: string;
  runningProgramHistory?: RunningProgramSnapshot[];
  strengthCoachFeedback?: string;
  runningCoachFeedback?: string;
  updatedAt: string;
  updatedByUid: string;
  updatedByName?: string;
  updatedByRole?: string;
};

const RUNNING_PACE_OPTIONS: Array<{ value: RunningPaceType; label: string }> = [
  { value: "steady", label: "קצב קבוע" },
  { value: "intervals", label: "קצב משתנה בין מהיר לקל" },
];

const RUNNING_MANIPULATION_OPTIONS: Array<{
  value: RunningManipulationType;
  label: string;
}> = [
  { value: "volume", label: "ריצת נפח" },
  { value: "fartlek", label: "ריצת פארטלק" },
  { value: "tempo", label: "ריצת טמפו" },
  { value: "threshold", label: "ריצת טראשהולד" },
  { value: "intervals", label: "אינטרוולים" },
  { value: "recovery", label: "ריצת התאוששות" },
  { value: "hills", label: "עליות" },
];

function getClientResolvedUid(client: ClientItem) {
  return String(client.authUid || client.uid || client.id || "").trim();
}

function createId(prefix = "id") {
  return `${Date.now()}-${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function createExercise(): ProgramExercise {
  return { id: createId("exercise"), name: "", sets: "", reps: "", notes: "" };
}

function createSection(title = ""): ProgramSection {
  return { id: createId("section"), title, exercises: [createExercise()] };
}

function createRunningWeek(weekNumber = 1): RunningWeek {
  return {
    id: createId("running-week"),
    weekNumber,
    distanceKm: "",
    pacePerKm: "",
    paceType: "steady",
    manipulationType: "volume",
    notes: "",
    clientSucceeded: null,
    clientNotes: "",
    coachFeedback: "",
  };
}

function getSectionsBySplit(splitType: TrainingSplitType): ProgramSection[] {
  if (splitType === "fullbody") return [createSection("פול באדי")];
  if (splitType === "ab")
    return [createSection("אימון A"), createSection("אימון B")];
  if (splitType === "abc")
    return [
      createSection("אימון A"),
      createSection("אימון B"),
      createSection("אימון C"),
    ];
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

function mergeExerciseHistory(
  ...groups: Array<Array<string | undefined | null> | undefined>
) {
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

function hasStrengthContent(sections: ProgramSection[], notes: string) {
  return (
    sections.some(
      (section) =>
        section.title.trim() ||
        section.exercises.some(
          (exercise) =>
            exercise.name.trim() ||
            exercise.sets.trim() ||
            exercise.reps.trim() ||
            exercise.notes.trim(),
        ),
    ) || notes.trim().length > 0
  );
}

function normalizeNumberInput(value: string, allowDecimal = true) {
  const cleaned = String(value || "").replace(
    allowDecimal ? /[^0-9.]/g : /[^0-9]/g,
    "",
  );
  if (!allowDecimal) return cleaned;
  const parts = cleaned.split(".");
  return parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;
}

function normalizePaceInput(value: string) {
  const digits = String(value || "")
    .replace(/[^0-9]/g, "")
    .slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}

function secondsToPace(totalSeconds: number) {
  const safe = Math.max(0, Math.min(59 * 60 + 59, totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function paceToSeconds(value?: string) {
  const [minutesRaw, secondsRaw] = String(value || "00:00").split(":");
  const minutes = Math.max(0, Math.min(59, Number(minutesRaw) || 0));
  const seconds = Math.max(0, Math.min(59, Number(secondsRaw) || 0));
  return minutes * 60 + seconds;
}

function getPaceMinutes(totalSeconds: number) {
  return Math.floor(Math.max(0, totalSeconds) / 60);
}

function getPaceSeconds(totalSeconds: number) {
  return Math.max(0, totalSeconds) % 60;
}

function buildRunningWeeks(countValue: string, previousWeeks: RunningWeek[]) {
  const count = Math.min(
    Math.max(Number(String(countValue || "").replace(/[^0-9]/g, "")) || 1, 1),
    52,
  );
  return Array.from({ length: count }).map((_, index) => {
    const old = previousWeeks[index];
    return old
      ? { ...old, weekNumber: index + 1 }
      : createRunningWeek(index + 1);
  });
}


function normalizeRunningWeeksForSave(weeks: RunningWeek[]) {
  return weeks
    .map((week, index) => ({
      ...week,
      id: week.id || createId("running-week"),
      weekNumber: index + 1,
      distanceKm: String(week.distanceKm || "").trim(),
      pacePerKm: String(week.pacePerKm || "").trim(),
      notes: String(week.notes || "").trim(),
      coachFeedback: String(week.coachFeedback || "").trim(),
      coachFeedbackUpdatedAt: String(week.coachFeedback || "").trim()
        ? week.coachFeedbackUpdatedAt || new Date().toISOString()
        : "",
    }))
    .filter((week) =>
      week.distanceKm ||
      week.pacePerKm ||
      week.notes ||
      week.paceType ||
      week.manipulationType,
    );
}

function hasRunningFeedback(week: RunningWeek) {
  return week.clientSucceeded === true || week.clientSucceeded === false;
}

function areAllRunningWeeksCompleted(weeks: RunningWeek[]) {
  const withContent = normalizeRunningWeeksForSave(weeks);
  return withContent.length > 0 && withContent.every(hasRunningFeedback);
}

function createRunningProgramSnapshot(params: {
  id?: string;
  runningWeeks: RunningWeek[];
  notes?: string;
  createdAt?: string;
  archivedAt?: string;
}): RunningProgramSnapshot {
  const cleanedWeeks = normalizeRunningWeeksForSave(params.runningWeeks);
  const createdAt = params.createdAt || new Date().toISOString();
  const completed = areAllRunningWeeksCompleted(cleanedWeeks);
  const snapshot: RunningProgramSnapshot = {
    id: params.id || createId("running-program"),
    title: `תוכנית ריצה ${new Date(createdAt).toLocaleDateString("he-IL")}`,
    createdAt,
    archivedAt: params.archivedAt || new Date().toISOString(),
    runningWeeksCount: cleanedWeeks.length,
    runningWeeks: cleanedWeeks,
    notes: String(params.notes || "").trim(),
  };
  if (completed) snapshot.completedAt = new Date().toISOString();
  return snapshot;
}

function resetRunningWeekClientProgress(week: RunningWeek, index: number): RunningWeek {
  return {
    ...week,
    id: week.id || createId("running-week"),
    weekNumber: index + 1,
    clientSucceeded: null,
    clientNotes: "",
    clientUpdatedAt: "",
    coachFeedback: "",
    coachFeedbackUpdatedAt: "",
  };
}

function OptionButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionButtonsWrap}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.85}
            onPress={() => onChange(option.value)}
            style={[styles.optionButton, selected && styles.optionButtonActive]}
          >
            <Text
              style={[
                styles.optionButtonText,
                selected && styles.optionButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ProgramTypeButtons({
  value,
  onChange,
}: {
  value: ProgramType;
  onChange: (next: ProgramType) => void;
}) {
  return (
    <View style={styles.splitButtonsWrap}>
      <View style={styles.splitButtonsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChange("strength")}
          style={[
            styles.splitButton,
            value === "strength" && styles.splitButtonActive,
          ]}
        >
          <Text
            style={[
              styles.splitButtonText,
              value === "strength" && styles.splitButtonTextActive,
            ]}
          >
            תוכנית כוח
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChange("running")}
          style={[
            styles.splitButton,
            value === "running" && styles.splitButtonActive,
          ]}
        >
          <Text
            style={[
              styles.splitButtonText,
              value === "running" && styles.splitButtonTextActive,
            ]}
          >
            תוכנית ריצה
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SplitTypeButtons({
  value,
  onChange,
}: {
  value: TrainingSplitType;
  onChange: (next: TrainingSplitType) => void;
}) {
  const options: Array<{ value: TrainingSplitType; label: string }> = [
    { value: "fullbody", label: "פול באדי" },
    { value: "ab", label: "AB" },
    { value: "abc", label: "ABC" },
    { value: "abcd", label: "ABCD" },
  ];
  return <OptionButtons value={value} options={options} onChange={onChange} />;
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
      if (!merged.some((item) => getClientResolvedUid(item) === selfUid))
        merged.unshift(selfItem);
    }
    return merged.sort((a, b) => {
      const aIsSelf =
        !!selfItem &&
        getClientResolvedUid(a) === getClientResolvedUid(selfItem);
      const bIsSelf =
        !!selfItem &&
        getClientResolvedUid(b) === getClientResolvedUid(selfItem);
      if (aIsSelf) return -1;
      if (bIsSelf) return 1;
      return String(a.name || "").localeCompare(String(b.name || ""), "he");
    });
  }, [clients, selfItem]);

  const [selectedClientUid, setSelectedClientUid] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [programType, setProgramType] = useState<ProgramType>("strength");
  const [sections, setSections] = useState<ProgramSection[]>([]);
  const [strengthNotes, setStrengthNotes] = useState("");
  const [runningNotes, setRunningNotes] = useState("");
  const [splitType, setSplitType] = useState<TrainingSplitType>("fullbody");
  const [exerciseHistory, setExerciseHistory] = useState<string[]>([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{
    sectionId: string;
    exerciseId: string;
  } | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [runningWeeksCount, setRunningWeeksCount] = useState("4");
  const [runningWeeks, setRunningWeeks] = useState<RunningWeek[]>(
    buildRunningWeeks("4", []),
  );
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);
  const [pacePickerWeekId, setPacePickerWeekId] = useState<string | null>(null);
  const [pacePickerDraftSeconds, setPacePickerDraftSeconds] = useState(0);

  const selectedClient = useMemo(
    () =>
      selectablePeople.find(
        (client) => getClientResolvedUid(client) === selectedClientUid,
      ),
    [selectablePeople, selectedClientUid],
  );
  const pacePickerMinutes = getPaceMinutes(pacePickerDraftSeconds);
  const pacePickerSeconds = getPaceSeconds(pacePickerDraftSeconds);

  const filteredSelectablePeople = useMemo(() => {
    const search = String(clientSearchQuery || "")
      .trim()
      .toLowerCase();
    if (!search) return selectablePeople;
    return selectablePeople.filter(
      (client) =>
        String(client.name || "")
          .toLowerCase()
          .includes(search) ||
        String(client.email || "")
          .toLowerCase()
          .includes(search) ||
        getClientResolvedUid(client).toLowerCase().includes(search),
    );
  }, [clientSearchQuery, selectablePeople]);

  useEffect(() => {
    if (!selectedClientUid) {
      setProgramType("strength");
      setSections([]);
      setStrengthNotes("");
      setRunningNotes("");
      setSplitType("fullbody");
      setExerciseHistory([]);
      setRunningWeeksCount("4");
      setRunningWeeks(buildRunningWeeks("4", []));
      return;
    }

    let isMounted = true;

    const loadProgram = async () => {
      try {
        setLoadingProgram(true);
        const programSnap = await getDoc(
          doc(db, "clientTrainingPrograms", selectedClientUid),
        );
        if (!isMounted) return;

        if (programSnap.exists()) {
          const data = programSnap.data() as Partial<TrainingProgramDoc> & {
            programText?: string;
          };
          const savedProgramType: ProgramType =
            data.programType === "running" ? "running" : "strength";
          const savedSplitType: TrainingSplitType =
            data.splitType === "ab" ||
            data.splitType === "abc" ||
            data.splitType === "abcd" ||
            data.splitType === "fullbody"
              ? data.splitType
              : "fullbody";
          const nextSections = Array.isArray(data.sections)
            ? data.sections
            : [];
          const savedRunningWeeks = Array.isArray(data.runningWeeks)
            ? data.runningWeeks
            : [];
          const savedWeeksCount = String(
            data.runningWeeksCount || savedRunningWeeks.length || 4,
          );

          setProgramType(savedProgramType);
          setSplitType(savedSplitType);
          setSections(
            nextSections.length > 0
              ? nextSections
              : getSectionsBySplit(savedSplitType),
          );
          setStrengthNotes(String(data.strengthNotes || data.notes || data.programText || ""));
          setRunningNotes(String(data.runningNotes || data.notes || data.programText || ""));
          setExerciseHistory(
            mergeExerciseHistory(
              Array.isArray(data.exerciseHistory) ? data.exerciseHistory : [],
              getExerciseNamesFromSections(nextSections),
            ),
          );
          setRunningWeeksCount(savedWeeksCount);
          setRunningWeeks(
            buildRunningWeeks(savedWeeksCount, savedRunningWeeks),
          );
        } else {
          setProgramType("strength");
          setSplitType("fullbody");
          setSections(getSectionsBySplit("fullbody"));
          setStrengthNotes("");
      setRunningNotes("");
          setExerciseHistory([]);
          setRunningWeeksCount("4");
          setRunningWeeks(buildRunningWeeks("4", []));
        }
      } catch (error) {
        console.error("שגיאה בטעינת תוכנית אימון:", error);
        if (isMounted) Alert.alert("שגיאה", "לא ניתן לטעון את תוכנית האימון");
      } finally {
        if (isMounted) setLoadingProgram(false);
      }
    };

    loadProgram();
    return () => {
      isMounted = false;
    };
  }, [selectedClientUid]);

  useEffect(() => {
    if (selectedClientUid && selectedClient)
      setClientSearchQuery(
        String(selectedClient.name || selectedClient.email || ""),
      );
  }, [selectedClient, selectedClientUid]);

  const handleClientSearchChange = (value: string) => {
    setClientSearchQuery(value);
    setIsClientMenuOpen(true);
    if (!value.trim()) setSelectedClientUid("");
  };

  const handleSelectClient = (client: ClientItem) => {
    setSelectedClientUid(getClientResolvedUid(client));
    setClientSearchQuery(String(client.name || client.email || ""));
    setIsClientMenuOpen(false);
  };

  const clearSelectedClient = () => {
    setSelectedClientUid("");
    setClientSearchQuery("");
    setIsClientMenuOpen(false);
  };

  const applySplitTemplate = (nextSplitType: TrainingSplitType) => {
    if (nextSplitType === splitType) return;
    setSplitType(nextSplitType);
    setSections(getSectionsBySplit(nextSplitType));
  };

  const updateSectionTitle = (sectionId: string, value: string) =>
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, title: value } : section,
      ),
    );

  const updateExerciseField = (
    sectionId: string,
    exerciseId: string,
    field: keyof Omit<ProgramExercise, "id">,
    value: string,
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
                  : exercise,
              ),
            },
      ),
    );
  };

  const filteredExerciseHistory = useMemo(() => {
    const search = normalizeExerciseName(historySearch);
    if (!search) return exerciseHistory;
    return exerciseHistory.filter((name) =>
      normalizeExerciseName(name).includes(search),
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
      exerciseName,
    );
    closeExerciseHistory();
  };

  const addSection = () => setSections((prev) => [...prev, createSection("")]);
  const removeSection = (sectionId: string) =>
    setSections((prev) => prev.filter((section) => section.id !== sectionId));
  const addExercise = (sectionId: string) =>
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, exercises: [...section.exercises, createExercise()] }
          : section,
      ),
    );
  const removeExercise = (sectionId: string, exerciseId: string) =>
    setSections((prev) =>
      prev.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              exercises: section.exercises.filter(
                (exercise) => exercise.id !== exerciseId,
              ),
            },
      ),
    );

  const renumberRunningWeeks = (weeks: RunningWeek[]) =>
    weeks.map((week, index) => ({ ...week, weekNumber: index + 1 }));

  const addRunningWeek = () => {
    setRunningWeeks((prev) => {
      const next = renumberRunningWeeks([...prev, createRunningWeek(prev.length + 1)]);
      setRunningWeeksCount(String(next.length));
      return next;
    });
  };

  const removeRunningWeek = (weekId: string) => {
    setRunningWeeks((prev) => {
      if (prev.length <= 1) return prev;
      const next = renumberRunningWeeks(prev.filter((week) => week.id !== weekId));
      setRunningWeeksCount(String(next.length));
      return next;
    });
  };

  const updateRunningWeeksCount = (value: string) => {
    const cleaned = normalizeNumberInput(value, false);
    setRunningWeeksCount(cleaned);
    setRunningWeeks((prev) => buildRunningWeeks(cleaned || "1", prev));
  };

  const updateRunningWeek = (
    weekId: string,
    field: keyof RunningWeek,
    value: string | RunningPaceType | RunningManipulationType,
  ) => {
    setRunningWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        if (field === "distanceKm")
          return {
            ...week,
            distanceKm: normalizeNumberInput(String(value), true),
          };
        if (field === "pacePerKm")
          return { ...week, pacePerKm: normalizePaceInput(String(value)) };
        return { ...week, [field]: value };
      }),
    );
  };

  const handleSave = async () => {
    const signedInUser = auth.currentUser;
    if (!signedInUser) return Alert.alert("שגיאה", "לא נמצא משתמש מחובר");
    const targetClient = selectedClient || selectablePeople.find((client) => getClientResolvedUid(client) === selectedClientUid) || null;
    if (!targetClient)
      return Alert.alert("שגיאה", "יש לבחור מתאמן או את עצמך");

    const resolvedClientUid = getClientResolvedUid(targetClient);
    if (!resolvedClientUid) return Alert.alert("שגיאה", "לא נמצא מזהה תקין");

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
              exercise.name || exercise.sets || exercise.reps || exercise.notes,
          ),
      }))
      .filter((section) => section.title || section.exercises.length > 0);

    const cleanedRunningWeeks = normalizeRunningWeeksForSave(runningWeeks);

    if (
      programType === "strength" &&
      cleanedSections.length === 0 &&
      !strengthNotes.trim()
    )
      return Alert.alert("שגיאה", "יש למלא לפחות כותרת אחת או תרגיל אחד");
    if (
      programType === "running" &&
      cleanedRunningWeeks.some((week) => !week.distanceKm || !week.pacePerKm)
    )
      return Alert.alert(
        "שגיאה",
        "בתוכנית ריצה יש למלא מרחק וזמן לק״מ בכל שבוע",
      );

    try {
      setSavingProgram(true);
      const nextExerciseHistory = mergeExerciseHistory(
        exerciseHistory,
        getExerciseNamesFromSections(cleanedSections),
      );

      const programRef = doc(db, "clientTrainingPrograms", resolvedClientUid);
      const existingSnap = await getDoc(programRef);
      const existingData = existingSnap.exists() ? (existingSnap.data() as Partial<TrainingProgramDoc>) : {};
      const nowIso = new Date().toISOString();

      const basePayload: Partial<TrainingProgramDoc> = {
        clientUid: resolvedClientUid,
        clientDocId: targetClient.id,
        clientName: targetClient.name || "",
        clientEmail: targetClient.email || "",
        clientRole:
          selfItem && resolvedClientUid === getClientResolvedUid(selfItem)
            ? "self"
            : targetClient.role || "client",
        programType,
        splitType,
        strengthNotes: strengthNotes.trim(),
        runningNotes: runningNotes.trim(),
        notes: programType === "strength" ? strengthNotes.trim() : runningNotes.trim(),
        exerciseHistory: nextExerciseHistory,
        updatedAt: nowIso,
        updatedByUid: signedInUser.uid,
        updatedByName: currentUserData?.name || "",
        updatedByRole: currentUserData?.role || "",
      };

      const payload: Partial<TrainingProgramDoc> =
        programType === "strength"
          ? { ...basePayload, sections: cleanedSections }
          : {
              ...basePayload,
              runningWeeksCount: cleanedRunningWeeks.length,
              runningWeeks: cleanedRunningWeeks,
              activeRunningProgramId: existingData.activeRunningProgramId || createId("running-program"),
              runningProgramStartedAt: existingData.runningProgramStartedAt || nowIso,
            };

      await setDoc(programRef, payload, { merge: true });
      setExerciseHistory(nextExerciseHistory);
      if (programType === "running") {
        setRunningWeeks(cleanedRunningWeeks);
        setRunningWeeksCount(String(cleanedRunningWeeks.length));
      } else {
        setSections(cleanedSections.length > 0 ? cleanedSections : sections);
      }
      Platform.OS === "web"
        ? window.alert("תוכנית האימון נשמרה בהצלחה")
        : Alert.alert("הצלחה", "תוכנית האימון נשמרה בהצלחה");
      // חשוב: לא קוראים כאן ל-onAfterSave כדי שלא יהיה ריענון שמוציא את המאמן מהתוכנית שבנה.
    } catch (error) {
      console.error("שגיאה בשמירת תוכנית אימון:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור את תוכנית האימון");
    } finally {
      setSavingProgram(false);
    }
  };


  const handleArchiveRunningProgramAndReset = async () => {
    const signedInUser = auth.currentUser;
    if (!signedInUser) return Alert.alert("שגיאה", "לא נמצא משתמש מחובר");
    const targetClient = selectedClient || selectablePeople.find((client) => getClientResolvedUid(client) === selectedClientUid) || null;
    if (!targetClient) return Alert.alert("שגיאה", "יש לבחור מתאמן או את עצמך");

    const resolvedClientUid = getClientResolvedUid(targetClient);
    if (!resolvedClientUid) return Alert.alert("שגיאה", "לא נמצא מזהה תקין");

    try {
      setSavingProgram(true);
      const nowIso = new Date().toISOString();
      const programRef = doc(db, "clientTrainingPrograms", resolvedClientUid);
      const existingSnap = await getDoc(programRef);
      const existingData = existingSnap.exists() ? (existingSnap.data() as Partial<TrainingProgramDoc>) : {};
      const existingWeeks = Array.isArray(existingData.runningWeeks) ? existingData.runningWeeks : [];
      const history = Array.isArray(existingData.runningProgramHistory) ? existingData.runningProgramHistory : [];
      const activeWeeksForHistory = normalizeRunningWeeksForSave(existingWeeks);

      const nextHistory =
        activeWeeksForHistory.length > 0
          ? [
              createRunningProgramSnapshot({
                id: existingData.activeRunningProgramId,
                runningWeeks: activeWeeksForHistory,
                notes: String(existingData.runningNotes || existingData.notes || ""),
                runningNotes: String(existingData.runningNotes || existingData.notes || ""),
                createdAt: existingData.runningProgramStartedAt || existingData.updatedAt,
                archivedAt: nowIso,
              }),
              ...history,
            ]
          : history;

      await setDoc(
        programRef,
        {
          clientUid: resolvedClientUid,
          clientDocId: targetClient.id,
          clientName: targetClient.name || "",
          clientEmail: targetClient.email || "",
          clientRole:
            selfItem && resolvedClientUid === getClientResolvedUid(selfItem)
              ? "self"
              : targetClient.role || "client",
          programType: "running",
          runningWeeksCount: 0,
          runningWeeks: [],
          activeRunningProgramId: "",
          runningProgramStartedAt: "",
          runningProgramHistory: nextHistory,
          runningNotes: "",
          notes: "",
          updatedAt: nowIso,
          updatedByUid: signedInUser.uid,
          updatedByName: currentUserData?.name || "",
          updatedByRole: currentUserData?.role || "",
        },
        { merge: true },
      );

      const emptyRunningWeeks = buildRunningWeeks("4", []);
      setProgramType("running");
      setRunningNotes("");
      setRunningWeeksCount("4");
      setRunningWeeks(emptyRunningWeeks);
      setPacePickerWeekId(null);
      setPacePickerDraftSeconds(0);

      Platform.OS === "web"
        ? window.alert("התוכנית הפעילה עברה להיסטוריה והשדות אופסו. התוכנית החדשה תוצג ללקוח רק אחרי לחיצה על שמירת עריכה לתוכנית.")
        : Alert.alert("הצלחה", "התוכנית הפעילה עברה להיסטוריה והשדות אופסו. התוכנית החדשה תוצג ללקוח רק אחרי לחיצה על שמירת עריכה לתוכנית.");
    } catch (error) {
      console.error("שגיאה בהעברת תוכנית ריצה להיסטוריה:", error);
      Alert.alert("שגיאה", "לא ניתן להעביר את תוכנית הריצה להיסטוריה");
    } finally {
      setSavingProgram(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>בניית תוכנית אימון מקצועית</Text>
        <Text style={styles.subtitle}>
          כאן בונים ושומרים בלבד את תוכנית הכוח או תוכנית הריצה ללקוח.
          תגובות הלקוח ומשוב המאמן מנוהלים במסך מעקב אחרי אימון לקוח.
        </Text>
      </View>

      {selectablePeople.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>אין לקוחות זמינים להצגה</Text>
        </View>
      ) : (
        <>
          <View style={styles.clientPickerBox}>
            <Text style={styles.label}>מציאת לקוח לבניית תוכנית אימון</Text>
            <View style={styles.clientSearchInputWrap}>
              <TextInput
                value={clientSearchQuery}
                onChangeText={handleClientSearchChange}
                onFocus={() => setIsClientMenuOpen(true)}
                placeholder="הקלידי שם, אימייל או מזהה לקוח"
                placeholderTextColor="#94A3B8"
                style={styles.clientSearchInput}
                textAlign="right"
                autoCapitalize="none"
              />
              {clientSearchQuery.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={clearSelectedClient}
                  style={styles.clientSearchClearButton}
                >
                  <Text style={styles.clientSearchClearText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsClientMenuOpen((prev) => !prev)}
              style={styles.clientMenuToggleButton}
            >
              <Text style={styles.clientMenuToggleText}>
                {isClientMenuOpen ? "סגירת תפריט לקוחות" : "פתיחת תפריט לקוחות"}
              </Text>
            </TouchableOpacity>
            {isClientMenuOpen && (
              <View style={styles.clientDropdown}>
                {filteredSelectablePeople.length === 0 ? (
                  <View style={styles.clientDropdownEmptyBox}>
                    <Text style={styles.clientDropdownEmptyText}>
                      לא נמצא לקוח מתאים
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.clientDropdownScroll}
                    contentContainerStyle={styles.clientDropdownContent}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {filteredSelectablePeople.map((client) => {
                      const clientUid = getClientResolvedUid(client);
                      const isSelected = clientUid === selectedClientUid;
                      return (
                        <TouchableOpacity
                          key={`${client.id}-${clientUid}`}
                          activeOpacity={0.85}
                          onPress={() => handleSelectClient(client)}
                          style={[
                            styles.clientDropdownItem,
                            isSelected && styles.clientDropdownItemSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.clientDropdownName,
                              isSelected && styles.clientDropdownNameSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {client.name || "ללא שם"}
                          </Text>
                          {!!client.email && (
                            <Text
                              style={styles.clientDropdownMeta}
                              numberOfLines={1}
                            >
                              {client.email}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {selectedClientUid && (
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
                    <Text style={styles.label}>סוג תוכנית</Text>
                    <ProgramTypeButtons
                      value={programType}
                      onChange={setProgramType}
                    />
                  </View>

                  {programType === "strength" ? (
                    <>
                      <View style={styles.splitBox}>
                        <Text style={styles.label}>מבנה תוכנית כוח</Text>
                        <SplitTypeButtons
                          value={splitType}
                          onChange={applySplitTemplate}
                        />
                      </View>
                      {sections.map((section) => (
                        <View key={section.id} style={styles.sectionCard}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => removeSection(section.id)}
                            style={styles.removeButton}
                          >
                            <Text style={styles.removeButtonText}>
                              מחיקת כותרת
                            </Text>
                          </TouchableOpacity>
                          <TextInput
                            value={section.title}
                            onChangeText={(value) =>
                              updateSectionTitle(section.id, value)
                            }
                            placeholder="כותרת לדוגמה: פול באדי / אימון A"
                            placeholderTextColor="#94A3B8"
                            style={styles.sectionTitleInput}
                            textAlign="right"
                          />
                          {section.exercises.map((exercise, exerciseIndex) => (
                            <View key={exercise.id} style={styles.exerciseCard}>
                              <View style={styles.exerciseHeader}>
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={() =>
                                    removeExercise(section.id, exercise.id)
                                  }
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
                                  updateExerciseField(
                                    section.id,
                                    exercise.id,
                                    "name",
                                    value,
                                  )
                                }
                                placeholder="שם תרגיל"
                                placeholderTextColor="#94A3B8"
                                style={styles.input}
                                textAlign="right"
                              />
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() =>
                                  openExerciseHistory(section.id, exercise.id)
                                }
                                style={styles.historyButton}
                              >
                                <Text style={styles.historyButtonText}>
                                  היסטוריית תרגילים
                                </Text>
                              </TouchableOpacity>
                              <View style={styles.rowInputs}>
                                <View style={styles.halfField}>
                                  <TextInput
                                    value={exercise.sets}
                                    onChangeText={(value) =>
                                      updateExerciseField(
                                        section.id,
                                        exercise.id,
                                        "sets",
                                        normalizeNumberInput(value, false),
                                      )
                                    }
                                    placeholder="סטים"
                                    placeholderTextColor="#94A3B8"
                                    style={[
                                      styles.halfInput,
                                      styles.fieldInput,
                                    ]}
                                    textAlign="right"
                                    keyboardType="numeric"
                                  />
                                </View>
                                <View style={styles.halfField}>
                                  <TextInput
                                    value={exercise.reps}
                                    onChangeText={(value) =>
                                      updateExerciseField(
                                        section.id,
                                        exercise.id,
                                        "reps",
                                        normalizeNumberInput(value, false),
                                      )
                                    }
                                    placeholder="חזרות"
                                    placeholderTextColor="#94A3B8"
                                    style={[
                                      styles.halfInput,
                                      styles.fieldInput,
                                    ]}
                                    textAlign="right"
                                    keyboardType="numeric"
                                  />
                                </View>
                              </View>
                              <TextInput
                                value={exercise.notes}
                                onChangeText={(value) =>
                                  updateExerciseField(
                                    section.id,
                                    exercise.id,
                                    "notes",
                                    value,
                                  )
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
                        <Text style={styles.addSectionButtonText}>
                          הוספת כותרת חדשה
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.runningBox}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                          מספר שבועות לתוכנית ריצה
                        </Text>
                        <TextInput
                          value={runningWeeksCount}
                          onChangeText={updateRunningWeeksCount}
                          placeholder="לדוגמה: 8"
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                          textAlign="right"
                          keyboardType="numeric"
                        />
                      </View>
                      {runningWeeks.map((week) => (
                        <View key={week.id} style={styles.runningWeekCard}>
                          <View style={styles.runningWeekHeaderRow}>
                            <Text style={styles.runningWeekTitle}>שבוע {week.weekNumber}</Text>
                            {runningWeeks.length > 1 && (
                              <TouchableOpacity activeOpacity={0.85} onPress={() => removeRunningWeek(week.id)} style={styles.deleteWeekButton}>
                                <Text style={styles.deleteWeekButtonText}>מחיקת שבוע</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.rowInputs}>
                            <View style={styles.halfField}>
                              <Text style={styles.smallLabel}>מרחק בק״מ</Text>
                              <TextInput
                                value={week.distanceKm}
                                onChangeText={(value) =>
                                  updateRunningWeek(
                                    week.id,
                                    "distanceKm",
                                    value,
                                  )
                                }
                                placeholder="5"
                                placeholderTextColor="#94A3B8"
                                style={[styles.halfInput, styles.fieldInput]}
                                textAlign="right"
                                keyboardType={
                                  Platform.OS === "ios"
                                    ? "decimal-pad"
                                    : "numeric"
                                }
                              />
                            </View>
                            <View style={styles.halfField}>
                              <Text style={styles.smallLabel}>זמן לק״מ</Text>
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => {
                                  setPacePickerWeekId(week.id);
                                  setPacePickerDraftSeconds(
                                    paceToSeconds(week.pacePerKm),
                                  );
                                }}
                                style={[
                                  styles.halfInput,
                                  styles.fieldInput,
                                  styles.pacePickerButton,
                                ]}
                              >
                                <Text style={styles.pacePickerButtonText}>
                                  {week.pacePerKm || "בחירת דק׳:שנ׳"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={styles.label}>צורת ריצה</Text>
                          <OptionButtons
                            value={week.paceType}
                            options={RUNNING_PACE_OPTIONS}
                            onChange={(value) =>
                              updateRunningWeek(week.id, "paceType", value)
                            }
                          />
                          <Text style={styles.label}>מניפולציה</Text>
                          <OptionButtons
                            value={week.manipulationType}
                            options={RUNNING_MANIPULATION_OPTIONS}
                            onChange={(value) =>
                              updateRunningWeek(
                                week.id,
                                "manipulationType",
                                value,
                              )
                            }
                          />
                          <TextInput
                            value={week.notes}
                            onChangeText={(value) =>
                              updateRunningWeek(week.id, "notes", value)
                            }
                            placeholder="הערות לשבוע הזה"
                            placeholderTextColor="#94A3B8"
                            style={[styles.input, styles.multilineInput]}
                            textAlign="right"
                            multiline
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.label}>
                    {programType === "running" ? "הערות כלליות לריצה" : "הערות כלליות לכוח"}
                  </Text>
                  <TextInput
                    value={programType === "running" ? runningNotes : strengthNotes}
                    onChangeText={programType === "running" ? setRunningNotes : setStrengthNotes}
                    placeholder={programType === "running" ? "הערות כלליות לתוכנית הריצה" : "הערות כלליות לתוכנית הכוח"}
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, styles.multilineInput]}
                    textAlign="right"
                    multiline
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSave}
                    disabled={savingProgram}
                    style={[
                      styles.saveButton,
                      savingProgram && styles.disabledButton,
                    ]}
                  >
                    {savingProgram ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>שמירת עריכה לתוכנית</Text>
                    )}
                  </TouchableOpacity>
                  {programType === "running" && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleArchiveRunningProgramAndReset}
                      disabled={savingProgram}
                      style={[styles.newRunningProgramButton, savingProgram && styles.disabledButton]}
                    >
                      <Text style={styles.newRunningProgramButtonText}>העבר תוכנית פעילה להיסטוריה ואפס שדות</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        </>
      )}

      <Modal
        visible={!!pacePickerWeekId}
        transparent
        animationType="fade"
        onRequestClose={() => setPacePickerWeekId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paceModalCard}>
            <Text style={styles.historyModalTitle}>בחירת קצב לק״מ</Text>
            <Text style={styles.paceModalSubtitle}>
              בחרי דקות ושניות. זה עובד רספונסיבית גם במסכים קטנים.
            </Text>
            <Text style={styles.pacePreviewText}>
              {secondsToPace(pacePickerDraftSeconds)}
            </Text>

            <View style={styles.paceColumnsRow}>
              <View style={styles.paceColumn}>
                <Text style={styles.paceColumnTitle}>דקות</Text>
                <ScrollView
                  style={styles.paceOptionsScroll}
                  contentContainerStyle={styles.paceOptionsContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {Array.from({ length: 60 }).map((_, minute) => (
                    <TouchableOpacity
                      key={`pace-minute-${minute}`}
                      activeOpacity={0.85}
                      onPress={() =>
                        setPacePickerDraftSeconds(
                          minute * 60 + pacePickerSeconds,
                        )
                      }
                      style={[
                        styles.paceOptionButton,
                        pacePickerMinutes === minute &&
                          styles.paceOptionButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.paceOptionText,
                          pacePickerMinutes === minute &&
                            styles.paceOptionTextActive,
                        ]}
                      >
                        {String(minute).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.paceColumn}>
                <Text style={styles.paceColumnTitle}>שניות</Text>
                <ScrollView
                  style={styles.paceOptionsScroll}
                  contentContainerStyle={styles.paceOptionsContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {Array.from({ length: 60 }).map((_, second) => (
                    <TouchableOpacity
                      key={`pace-second-${second}`}
                      activeOpacity={0.85}
                      onPress={() =>
                        setPacePickerDraftSeconds(
                          pacePickerMinutes * 60 + second,
                        )
                      }
                      style={[
                        styles.paceOptionButton,
                        pacePickerSeconds === second &&
                          styles.paceOptionButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.paceOptionText,
                          pacePickerSeconds === second &&
                            styles.paceOptionTextActive,
                        ]}
                      >
                        {String(second).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.paceModalButtonsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setPacePickerWeekId(null)}
                style={styles.cancelPaceButton}
              >
                <Text style={styles.cancelPaceButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  if (pacePickerWeekId)
                    updateRunningWeek(
                      pacePickerWeekId,
                      "pacePerKm",
                      secondsToPace(pacePickerDraftSeconds),
                    );
                  setPacePickerWeekId(null);
                }}
                style={styles.closeModalButton}
              >
                <Text style={styles.closeModalButtonText}>אישור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={historyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeExerciseHistory}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModalCard}>
            <Text style={styles.historyModalTitle}>
              בחירה מהיסטוריית תרגילים
            </Text>
            <TextInput
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholder="חיפוש תרגיל"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              textAlign="right"
            />
            <ScrollView
              style={styles.historyList}
              keyboardShouldPersistTaps="handled"
            >
              {filteredExerciseHistory.length === 0 ? (
                <Text style={styles.emptyText}>אין תרגילים שמורים עדיין</Text>
              ) : (
                filteredExerciseHistory.map((name) => (
                  <TouchableOpacity
                    key={name}
                    activeOpacity={0.85}
                    onPress={() => selectExerciseFromHistory(name)}
                    style={styles.historyItem}
                  >
                    <Text style={styles.historyItemText}>{name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={closeExerciseHistory}
              style={styles.closeModalButton}
            >
              <Text style={styles.closeModalButtonText}>סגירה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: 12 },
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
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  clientPickerBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  smallLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 5,
  },
  clientSearchInputWrap: { position: "relative" },
  clientSearchInput: {
    width: "100%",
    minHeight: 50,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 42,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    writingDirection: "rtl",
  },
  clientSearchClearButton: {
    position: "absolute",
    left: 10,
    top: 9,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  clientSearchClearText: {
    color: "#334155",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
  clientMenuToggleButton: {
    minHeight: 44,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clientMenuToggleText: {
    color: "#4338CA",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  clientDropdown: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 8,
  },
  clientDropdownScroll: { maxHeight: 240 },
  clientDropdownContent: { gap: 8 },
  clientDropdownEmptyBox: { padding: 14, alignItems: "center" },
  clientDropdownEmptyText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
  },
  clientDropdownItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "flex-end",
    gap: 3,
  },
  clientDropdownItemSelected: {
    backgroundColor: "#E0E7FF",
    borderColor: "#A5B4FC",
  },
  clientDropdownName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  clientDropdownNameSelected: { color: "#3730A3" },
  clientDropdownMeta: { color: "#64748B", fontSize: 12, textAlign: "right" },
  editorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
  },
  selectedClientBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    alignItems: "flex-end",
    gap: 3,
  },
  selectedClientLabel: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  selectedClientName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  selectedClientEmail: { color: "#475569", fontSize: 13, textAlign: "right" },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    gap: 8,
  },
  loaderText: { color: "#64748B", fontSize: 13, textAlign: "center" },
  splitBox: { gap: 8 },
  splitButtonsWrap: { gap: 8 },
  splitButtonsRow: { flexDirection: "row-reverse", gap: 8 },
  splitButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  splitButtonActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  splitButtonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  splitButtonTextActive: { color: "#FFFFFF" },
  optionButtonsWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  optionButton: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionButtonActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  optionButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  optionButtonTextActive: { color: "#FFFFFF" },
  sectionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  removeButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  removeButtonText: { color: "#DC2626", fontSize: 12, fontWeight: "800" },
  sectionTitleInput: {
    width: "100%",
    minHeight: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "800",
    writingDirection: "rtl",
  },
  exerciseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    gap: 9,
  },
  exerciseHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exerciseIndex: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  removeSmallButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  removeSmallButtonText: { color: "#DC2626", fontSize: 11, fontWeight: "800" },
  input: {
    width: "100%",
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    writingDirection: "rtl",
  },
  multilineInput: { minHeight: 92, textAlignVertical: "top" },
  historyButton: {
    minHeight: 42,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  historyButtonText: { color: "#4338CA", fontSize: 12, fontWeight: "800" },
  rowInputs: {
    width: "100%",
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: 8,
  },
  halfInput: {
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    writingDirection: "rtl",
  },
  fieldInput: { width: "100%", minWidth: 0 },
  halfField: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 128,
    minWidth: 0,
  },
  secondaryActionButton: {
    minHeight: 44,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionButtonText: {
    color: "#4338CA",
    fontSize: 13,
    fontWeight: "800",
  },
  addSectionButton: {
    minHeight: 48,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  addSectionButtonText: { color: "#334155", fontSize: 13, fontWeight: "800" },
  runningBox: { gap: 12 },
  inputGroup: { gap: 7 },
  runningWeekCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  runningWeekTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  runningWeekHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  deleteWeekButton: {
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  deleteWeekButtonText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  addWeekButton: {
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 4,
  },
  addWeekButtonText: {
    color: "#4338CA",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  newRunningProgramButton: {
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 10,
  },
  newRunningProgramButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  saveButton: {
    minHeight: 52,
    backgroundColor: "#2563EB",
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
  disabledButton: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
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
  historyModalTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  historyList: { maxHeight: 360 },
  historyItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 8,
    alignItems: "flex-end",
  },
  historyItemText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  closeModalButton: {
    minHeight: 46,
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalButtonText: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
  pacePickerButton: { alignItems: "center", justifyContent: "center" },
  pacePickerButtonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  paceModalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  paceModalSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
  pacePreviewText: {
    color: "#0F172A",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    direction: "ltr",
  },
  paceColumnsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  paceColumn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 8,
    gap: 8,
  },
  paceColumnTitle: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  paceOptionsScroll: { maxHeight: 230 },
  paceOptionsContent: { gap: 6, paddingBottom: 4 },
  paceOptionButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  paceOptionButtonActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  paceOptionText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  paceOptionTextActive: { color: "#FFFFFF" },
  paceModalButtonsRow: { flexDirection: "row-reverse", gap: 10 },
  cancelPaceButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelPaceButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  clientFeedbackBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 10,
    gap: 5,
  },
  clientFeedbackTitle: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  clientFeedbackText: {
    color: "#14532D",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 20,
  },
});
