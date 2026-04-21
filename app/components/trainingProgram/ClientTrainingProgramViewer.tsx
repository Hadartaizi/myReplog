import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../database/firebase";

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

type TrainingSplitType = "fullbody" | "ab" | "abc";

type TrainingProgramDoc = {
  sections?: ProgramSection[];
  notes?: string;
  updatedAt?: string;
  updatedByName?: string;
  programText?: string;
  splitType?: TrainingSplitType;
};

function formatDateTime(value?: string) {
  if (!value) return "לא זמין";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "לא זמין";

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getSplitLabel(splitType?: TrainingSplitType) {
  switch (splitType) {
    case "fullbody":
      return "פול באדי";
    case "ab":
      return "AB";
    case "abc":
      return "ABC";
    default:
      return "לא הוגדר";
  }
}

export default function ClientTrainingProgramViewer() {
  const [loading, setLoading] = useState(true);
  const [programData, setProgramData] = useState<TrainingProgramDoc | null>(null);

  const loadProgram = useCallback(async () => {
    try {
      setLoading(true);

      const authUser = auth.currentUser;
      if (!authUser) {
        setProgramData(null);
        return;
      }

      const resolvedUid = String(authUser.uid || "").trim();

      if (!resolvedUid) {
        setProgramData(null);
        return;
      }

      const programRef = doc(db, "clientTrainingPrograms", resolvedUid);
      const programSnap = await getDoc(programRef);

      if (programSnap.exists()) {
        setProgramData(programSnap.data() as TrainingProgramDoc);
      } else {
        setProgramData(null);
      }
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

  const sections = Array.isArray(programData?.sections) ? programData?.sections : [];

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>תוכנית אימון</Text>
        <Text style={styles.subtitle}>
          כאן אפשר לראות את תוכנית האימון האישית שנכתבה עבורך
        </Text>
      </View>

      <Pressable
        onPress={loadProgram}
        style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
      >
        <Text style={styles.refreshButtonText}>רענון</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={styles.loaderText}>טוען תוכנית אימון...</Text>
        </View>
      ) : sections.length === 0 && !programData?.notes && !programData?.programText ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>עדיין לא נוספה לך תוכנית אימון</Text>
          <Text style={styles.emptyText}>
            כשהמאמנת או המאמן ישמרו עבורך תוכנית, היא תופיע כאן
          </Text>
        </View>
      ) : (
        <View style={styles.programCard}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>סוג תוכנית</Text>
            <Text style={styles.metaValue}>{getSplitLabel(programData?.splitType)}</Text>

            <Text style={styles.metaLabel}>עודכן לאחרונה</Text>
            <Text style={styles.metaValue}>
              {formatDateTime(programData?.updatedAt)}
            </Text>

            {!!programData?.updatedByName && (
              <>
                <Text style={styles.metaLabel}>עודכן על ידי</Text>
                <Text style={styles.metaValue}>{programData.updatedByName}</Text>
              </>
            )}
          </View>

          <ScrollView
            style={styles.programScroll}
            contentContainerStyle={styles.programScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section, sectionIndex) => (
              <View
                key={section.id || `${section.title}-${sectionIndex}`}
                style={styles.sectionCard}
              >
                <Text style={styles.sectionTitle}>
                  {section.title || `חלק ${sectionIndex + 1}`}
                </Text>

                {section.exercises.map((exercise, exerciseIndex) => (
                  <View
                    key={exercise.id || `${exercise.name}-${exerciseIndex}`}
                    style={styles.exerciseRow}
                  >
                    <View style={styles.exerciseTopRow}>
                      <Text style={styles.exerciseName}>
                        {exercise.name || `תרגיל ${exerciseIndex + 1}`}
                      </Text>
                    </View>

                    <View style={styles.exerciseStatsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>סטים</Text>
                        <Text style={styles.statValue}>{exercise.sets || "-"}</Text>
                      </View>

                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>חזרות</Text>
                        <Text style={styles.statValue}>{exercise.reps || "-"}</Text>
                      </View>
                    </View>

                    {!!exercise.notes && (
                      <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}

            {!!programData?.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>הערות כלליות</Text>
                <Text style={styles.notesText}>{programData.notes}</Text>
              </View>
            )}

            {!programData?.notes && !!programData?.programText && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>הערות כלליות</Text>
                <Text style={styles.notesText}>{programData.programText}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
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
  refreshButton: {
    minHeight: 46,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  refreshButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 10,
  },
  loaderText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  programCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
  },
  metaBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    alignItems: "flex-end",
    gap: 4,
  },
  metaLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  metaValue: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  programScroll: {
    maxHeight: 520,
  },
  programScrollContent: {
    gap: 12,
    paddingBottom: 10,
  },
  sectionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  exerciseRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    gap: 8,
  },
  exerciseTopRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },
  exerciseStatsRow: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  statValue: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  exerciseNotes: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  notesBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    gap: 8,
  },
  notesTitle: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  notesText: {
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
    writingDirection: "rtl",
  },
  pressed: {
    opacity: 0.8,
  },
});