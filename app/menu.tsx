import { useFonts } from "expo-font";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { auth, db } from "../database/firebase";
import AppLayout from "./components/AppLayout";
import ClientAccessManager from "./components/admin/ClientAccessManager";
import CoachClientCreator from "./components/admin/CoachClientCreator";
import SecondaryAdminsManager from "./components/admin/SecondaryAdminsManager";
import {
  formatDateTimeIL,
  getRemainingTimeLabel,
} from "./components/admin/accessUtils";
import ClientExerciseLibrary from "./components/clientWorkout/ClientExerciseLibrary";
import ClientProgressTracker from "./components/clientWorkout/ClientProgressTracker";
import ClientTrainingProgramManager from "./components/trainingProgram/ClientTrainingProgramManager";
import ClientTrainingProgramViewer from "./components/trainingProgram/ClientTrainingProgramViewer";
import type { UserRole } from "./types/user";

const APP_BG = "#F4F7FB";

const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/hadar_taizi/";
const DEFAULT_WHATSAPP_PHONE = "972502507437";
const DEFAULT_PHONE_NUMBER = "0502507437";

type ClientItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  approvalStatus?: "pending" | "approved" | "blocked";
  accessStartAt?: string | null;
  accessEndAt?: string | null;
  createdByUid?: string | null;
  createdByOwnerUid?: string | null;
  hasLoginAccount?: boolean;
  authUid?: string | null;
  cardsPurchased?: number;
  cardsUsed?: number;
  cardUsageDates?: string[];
  cardPurchases?: CardPurchase[];
  instagramUrl?: string;
  whatsappPhone?: string;
  contactPhone?: string;
  contactOwnerUid?: string | null;
  contactUpdatedAt?: string | null;
};

type SecondaryAdminItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  approvalStatus?: "pending" | "approved" | "blocked";
  accessStartAt?: string | null;
  accessEndAt?: string | null;
  createdByOwnerUid?: string | null;
  isSecondaryAdmin?: boolean;
  authUid?: string | null;
};

type CurrentUserData = {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  approvalStatus?: "pending" | "approved" | "blocked";
  accessStartAt?: string | null;
  accessEndAt?: string | null;
  createdByOwnerUid?: string | null;
  isSecondaryAdmin?: boolean;
  createdByUid?: string | null;
  hasLoginAccount?: boolean;
  authUid?: string | null;
  uid?: string | null;
  cardsPurchased?: number;
  cardsUsed?: number;
  cardUsageDates?: string[];
  cardPurchases?: CardPurchase[];
  instagramUrl?: string;
  whatsappPhone?: string;
  contactPhone?: string;
  createdAt?: string;
  updatedAt?: string;
  contactOwnerUid?: string | null;
  contactUpdatedAt?: string | null;
};

type ContactData = {
  instagramUrl?: string;
  whatsappPhone?: string;
  contactPhone?: string;
  phone?: string;
  name?: string;
  uid?: string | null;
};

type ResolvedUserDoc = {
  docId: string;
  data: CurrentUserData;
};

type SecondaryAdminCountItem = {
  adminId: string;
  adminName: string;
  adminEmail: string;
  clientCount: number;
};

type CardPurchase = {
  id: string;
  purchasedCount: number;
  purchasedAt: string;
  updatedAt?: string;
  createdByUid?: string;
  createdByName?: string;
  usageDates: string[];
};

type ManualExerciseSetRow = {
  id: string;
  reps: string;
  weight: string;
  order: number;
};

type ManualExerciseRow = {
  id: string;
  exerciseName: string;
  sets: ManualExerciseSetRow[];
  order: number;
};

type ManualWorkoutEntryManagerProps = {
  clients: ClientItem[];
  currentUserData: CurrentUserData | null;
  onAfterSave?: () => Promise<void> | void;
};

function AdminIcon({ size = 20, color = "#1E293B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 12l1.7 1.7L14.8 10"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function GroupsIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="9" cy="9" r="3" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="16.5" cy="10" r="2.5" stroke={color} strokeWidth={2} fill="none" />
      <Path
        d="M3.5 18a5.5 5.5 0 0111 0"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M14 18a4 4 0 014-3.5A4 4 0 0122 18"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function WorkoutTrackingIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Line
        x1="8"
        y1="3.5"
        x2="8"
        y2="7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1="16"
        y1="3.5"
        x2="16"
        y2="7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line x1="4" y1="9" x2="20" y2="9" stroke={color} strokeWidth={2} />
      <Line
        x1="8"
        y1="13"
        x2="11"
        y2="13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1="8"
        y1="16"
        x2="14"
        y2="16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function normalizePhoneForWhatsapp(value?: string | null) {
  if (!value) return "";
  const digitsOnly = value.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  if (digitsOnly.startsWith("972")) return digitsOnly;
  if (digitsOnly.startsWith("0")) return `972${digitsOnly.slice(1)}`;
  return digitsOnly;
}

function normalizeInstagramUrl(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("@")) {
    return `https://www.instagram.com/${trimmed.slice(1)}/`;
  }

  if (trimmed.includes("instagram.com")) {
    return `https://${trimmed.replace(/^https?:\/\//, "")}`;
  }

  return `https://www.instagram.com/${trimmed.replace(/^@/, "")}/`;
}

const normalizeEmail = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getClientResolvedUid = (client: ClientItem) =>
  String(client.authUid || client.uid || client.id || "").trim();

const uniqueClientsByUid = (clients: ClientItem[]) => {
  const map = new Map<string, ClientItem>();

  for (const client of clients) {
    const resolvedUid = getClientResolvedUid(client);
    if (!resolvedUid) continue;

    const existing = map.get(resolvedUid);

    map.set(resolvedUid, {
      ...(existing || {}),
      ...client,
      uid: resolvedUid,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "he")
  );
};

const mapUserDocToClient = (docSnap: any): ClientItem => {
  const data = docSnap.data() || {};
  const resolvedUid = String(data.uid || data.authUid || docSnap.id || "").trim();

  return {
    id: docSnap.id,
    ...data,
    uid: resolvedUid,
  };
};

const buildUidCandidates = (...values: Array<string | null | undefined>) => {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  );
};

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createCardPurchaseId() {
  return `${Date.now()}-purchase-${Math.random().toString(36).slice(2, 9)}`;
}

function sortIsoDatesDesc(values: string[]) {
  return [...values].sort(
    (a, b) => (new Date(b).getTime() || 0) - (new Date(a).getTime() || 0)
  );
}

function removeUndefinedDeep(value: any): any {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.entries(value).reduce<Record<string, any>>((acc, [key, item]) => {
      if (item !== undefined) {
        acc[key] = removeUndefinedDeep(item);
      }
      return acc;
    }, {});
  }

  return value;
}

function cleanCardPurchaseForFirestore(purchase: CardPurchase): CardPurchase {
  return removeUndefinedDeep({
    id: String(purchase.id || createCardPurchaseId()),
    purchasedCount: Math.max(Number(purchase.purchasedCount || 0), 0),
    purchasedAt: String(purchase.purchasedAt || new Date().toISOString()),
    updatedAt: purchase.updatedAt ? String(purchase.updatedAt) : undefined,
    createdByUid: purchase.createdByUid ? String(purchase.createdByUid) : undefined,
    createdByName: purchase.createdByName ? String(purchase.createdByName) : undefined,
    usageDates: Array.isArray(purchase.usageDates)
      ? sortIsoDatesDesc(
          purchase.usageDates
            .map((date) => String(date || "").trim())
            .filter(Boolean)
        )
      : [],
  }) as CardPurchase;
}

function buildCardFirestorePayload(purchases: CardPurchase[], updatedAt: string) {
  const cleanPurchases = purchases
    .map((purchase) => cleanCardPurchaseForFirestore(purchase))
    .filter((purchase) => purchase.purchasedCount > 0);

  const allUsageDates = sortIsoDatesDesc(
    cleanPurchases.flatMap((purchase) => purchase.usageDates || [])
  );

  return removeUndefinedDeep({
    cardsPurchased: cleanPurchases.reduce((sum, purchase) => sum + purchase.purchasedCount, 0),
    cardsUsed: allUsageDates.length,
    cardUsageDates: allUsageDates,
    cardPurchases: cleanPurchases,
    updatedAt,
  });
}

function dateToDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateToTimeInputValue(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createLocalDateTimeIso(dateKey: string, timeValue: string) {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))
    ? String(dateKey)
    : getTodayDateInputValue();
  const safeTime = /^\d{2}:\d{2}$/.test(String(timeValue || ""))
    ? String(timeValue)
    : "12:00";
  const [year, month, day] = normalizedDate.split("-").map(Number);
  const [hours, minutes] = safeTime.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

function getWebDateTimeDisplay(type: "date" | "time", value: string) {
  if (type === "time") {
    const cleanTime = String(value || "").trim();
    return /^\d{2}:\d{2}$/.test(cleanTime) ? cleanTime : "12:00";
  }

  const cleanDate = String(value || "").trim();
  const match = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return cleanDate || getTodayDateInputValue();

  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

function WebDateTimeInput({
  type,
  value,
  onChange,
}: {
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
}) {
  if (Platform.OS !== "web") return null;

  return React.createElement(
    "label",
    {
      style: {
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#CBD5E1",
        backgroundColor: "#FFFFFF",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 8px",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
      },
    },
    React.createElement(
      "span",
      {
        style: {
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          color: "#0F172A",
          fontSize: 14,
          lineHeight: "20px",
          fontWeight: 800,
          textAlign: "center",
          direction: "ltr",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          pointerEvents: "none",
        },
      },
      getWebDateTimeDisplay(type, value)
    ),
    React.createElement("input", {
      type,
      value,
      onChange: (event: any) => onChange(String(event?.target?.value || "")),
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0,
        border: 0,
        padding: 0,
        margin: 0,
        cursor: "pointer",
      },
    })
  );
}

function normalizeCardPurchases(data?: Partial<ClientItem | CurrentUserData> | null) {
  const rawPurchases = Array.isArray(data?.cardPurchases) ? data?.cardPurchases || [] : [];

  const normalized = rawPurchases
    .map((purchase, index) => {
      const purchasedCount = Math.max(Number(purchase?.purchasedCount || 0), 0);
      if (purchasedCount <= 0) return null;

      const usageDates = Array.isArray(purchase?.usageDates)
        ? sortIsoDatesDesc(
            purchase.usageDates
              .map((date) => String(date || "").trim())
              .filter(Boolean)
          )
        : [];

      return cleanCardPurchaseForFirestore({
        id: String(purchase?.id || `purchase-${index + 1}`),
        purchasedCount,
        purchasedAt: String(purchase?.purchasedAt || data?.createdAt || new Date().toISOString()),
        updatedAt: purchase?.updatedAt,
        createdByUid: purchase?.createdByUid,
        createdByName: purchase?.createdByName,
        usageDates,
      } as CardPurchase);
    })
    .filter(Boolean) as CardPurchase[];

  if (normalized.length > 0) {
    return normalized.sort(
      (a, b) => (new Date(a.purchasedAt).getTime() || 0) - (new Date(b.purchasedAt).getTime() || 0)
    );
  }

  const legacyPurchased = Math.max(Number(data?.cardsPurchased || 0), 0);
  if (legacyPurchased <= 0) return [] as CardPurchase[];

  return [
    cleanCardPurchaseForFirestore({
      id: "legacy-purchase-1",
      purchasedCount: legacyPurchased,
      purchasedAt: String(data?.createdAt || new Date().toISOString()),
      updatedAt: data?.updatedAt,
      usageDates: Array.isArray(data?.cardUsageDates)
        ? sortIsoDatesDesc(
            data.cardUsageDates
              .map((date) => String(date || "").trim())
              .filter(Boolean)
          )
        : [],
    } as CardPurchase),
  ];
}

function getCardPurchaseStats(data?: Partial<ClientItem | CurrentUserData> | null) {
  const purchases = normalizeCardPurchases(data);
  const totalPurchased = purchases.reduce((sum, purchase) => sum + purchase.purchasedCount, 0);
  const totalUsed = purchases.reduce((sum, purchase) => sum + purchase.usageDates.length, 0);

  return {
    purchases,
    totalPurchased,
    totalUsed,
    totalRemaining: Math.max(totalPurchased - totalUsed, 0),
    allUsageDates: sortIsoDatesDesc(purchases.flatMap((purchase) => purchase.usageDates || [])),
  };
}

function normalizeDateInputToIso(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) {
    const now = new Date();
    return {
      iso: now.toISOString(),
      dateKey: getTodayDateInputValue(),
      display: getTodayDateInputValue(),
    };
  }

  const yyyyMmDdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDdMatch) {
    const [, year, month, day] = yyyyMmDdMatch;
    const iso = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0,
      0
    ).toISOString();

    return {
      iso,
      dateKey: `${year}-${month}-${day}`,
      display: `${year}-${month}-${day}`,
    };
  }

  const ddMmYyyyMatch = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (ddMmYyyyMatch) {
    const [, day, month, year] = ddMmYyyyMatch;
    const iso = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0,
      0
    ).toISOString();

    return {
      iso,
      dateKey: `${year}-${month}-${day}`,
      display: `${year}-${month}-${day}`,
    };
  }

  const now = new Date();
  return {
    iso: now.toISOString(),
    dateKey: getTodayDateInputValue(),
    display: getTodayDateInputValue(),
  };
}

function createEmptyManualExerciseSetRow(order = 1): ManualExerciseSetRow {
  return {
    id: `${Date.now()}-set-${Math.random().toString(36).slice(2, 9)}`,
    reps: "",
    weight: "",
    order,
  };
}

function createEmptyManualExerciseRow(order = 1): ManualExerciseRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    exerciseName: "",
    sets: [createEmptyManualExerciseSetRow(1)],
    order,
  };
}

function normalizeManualSetOrder(sets: ManualExerciseSetRow[]) {
  return sets.map((set, index) => ({
    ...set,
    order: index + 1,
  }));
}

function normalizeManualExerciseOrder(rows: ManualExerciseRow[]) {
  return rows.map((row, index) => ({
    ...row,
    order: index + 1,
    sets: normalizeManualSetOrder(row.sets || [createEmptyManualExerciseSetRow(1)]),
  }));
}

async function resolveCurrentUserDoc(): Promise<ResolvedUserDoc | null> {
  const authUser = auth.currentUser;
  if (!authUser) return null;

  const authUid = String(authUser.uid || "").trim();
  const authEmail = normalizeEmail(authUser.email);

  if (authUid) {
    const directRef = doc(db, "users", authUid);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      return {
        docId: directSnap.id,
        data: directSnap.data() as CurrentUserData,
      };
    }
  }

  if (authUid) {
    const byUidSnap = await getDocs(
      query(collection(db, "users"), where("uid", "==", authUid))
    );

    if (!byUidSnap.empty) {
      const found = byUidSnap.docs[0];
      return {
        docId: found.id,
        data: found.data() as CurrentUserData,
      };
    }
  }

  if (authUid) {
    const byAuthUidSnap = await getDocs(
      query(collection(db, "users"), where("authUid", "==", authUid))
    );

    if (!byAuthUidSnap.empty) {
      const found = byAuthUidSnap.docs[0];
      return {
        docId: found.id,
        data: found.data() as CurrentUserData,
      };
    }
  }

  if (authEmail) {
    const byEmailSnap = await getDocs(
      query(collection(db, "users"), where("email", "==", authEmail))
    );

    if (!byEmailSnap.empty) {
      const found = byEmailSnap.docs[0];
      return {
        docId: found.id,
        data: found.data() as CurrentUserData,
      };
    }
  }

  return null;
}

async function fetchClientsByField(
  field: "createdByUid" | "createdByOwnerUid" | "contactOwnerUid",
  values: string[]
) {
  const collected: ClientItem[] = [];
  const normalizedValues = Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  );

  for (const value of normalizedValues) {
    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "client"),
        where(field, "==", value)
      )
    );

    snap.docs.forEach((docSnap) => {
      collected.push(mapUserDocToClient(docSnap));
    });
  }

  return uniqueClientsByUid(collected);
}

async function fetchClientsForAnyLink(values: string[]) {
  const normalizedValues = Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  );

  if (normalizedValues.length === 0) {
    return [] as ClientItem[];
  }

  const [byCreated, byOwner, byContact] = await Promise.all([
    fetchClientsByField("createdByUid", normalizedValues),
    fetchClientsByField("createdByOwnerUid", normalizedValues),
    fetchClientsByField("contactOwnerUid", normalizedValues),
  ]);

  return uniqueClientsByUid([...byCreated, ...byOwner, ...byContact]);
}

async function fetchAdminsByOwner(ownerUidCandidates: string[]) {
  const admins: SecondaryAdminItem[] = [];
  const normalizedOwnerValues = Array.from(
    new Set(ownerUidCandidates.map((value) => String(value || "").trim()).filter(Boolean))
  );

  for (const ownerUid of normalizedOwnerValues) {
    const [adminsByOwnerSnap, adminsByCreatedSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "users"),
          where("role", "==", "admin"),
          where("createdByOwnerUid", "==", ownerUid)
        )
      ),
      getDocs(
        query(
          collection(db, "users"),
          where("role", "==", "admin"),
          where("createdByUid", "==", ownerUid)
        )
      ),
    ]);

    [...adminsByOwnerSnap.docs, ...adminsByCreatedSnap.docs].forEach((docSnap) => {
      const data = docSnap.data() || {};

      admins.push({
        id: docSnap.id,
        ...data,
        uid: String(data.uid || data.authUid || docSnap.id || "").trim(),
      });
    });
  }

  const uniqueMap = new Map<string, SecondaryAdminItem>();

  for (const admin of admins) {
    const key = String(admin.uid || admin.authUid || admin.id || "").trim();
    if (!key) continue;

    uniqueMap.set(key, {
      ...admin,
      uid: key,
    });
  }

  return Array.from(uniqueMap.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "he")
  );
}

async function fetchAllClientsForOwner(
  ownerUidCandidates: string[],
  adminsList: SecondaryAdminItem[]
) {
  const collectedClients: ClientItem[] = [];

  const ownerClients = await fetchClientsForAnyLink(ownerUidCandidates);
  collectedClients.push(...ownerClients);

  for (const admin of adminsList) {
    const adminUidCandidates = buildUidCandidates(admin.uid, admin.authUid, admin.id);

    const adminClients = await fetchClientsForAnyLink(adminUidCandidates);

    collectedClients.push(
      ...adminClients.map((client) => ({
        ...client,
        createdByOwnerUid: client.createdByOwnerUid || ownerUidCandidates[0] || null,
      }))
    );
  }

  return uniqueClientsByUid(collectedClients);
}

async function fetchAllClientsForAdmin(
  adminUidCandidates: string[],
  ownerUidCandidates: string[]
) {
  const collectedClients: ClientItem[] = [];

  const directAdminClients = await fetchClientsForAnyLink(adminUidCandidates);
  collectedClients.push(...directAdminClients);

  if (ownerUidCandidates.length > 0) {
    const ownerLinkedClients = await fetchClientsByField(
      "createdByOwnerUid",
      ownerUidCandidates
    );

    collectedClients.push(
      ...ownerLinkedClients.filter((client) => {
        const linkedAdminCandidates = buildUidCandidates(
          client.createdByUid,
          client.contactOwnerUid
        );

        return linkedAdminCandidates.some((value) =>
          adminUidCandidates.includes(value)
        );
      })
    );
  }

  return uniqueClientsByUid(collectedClients);
}

function ManualWorkoutEntryManager({
  clients,
  currentUserData,
  onAfterSave,
}: ManualWorkoutEntryManagerProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [workoutDate, setWorkoutDate] = useState(getTodayDateInputValue());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempWorkoutDate, setTempWorkoutDate] = useState<Date>(new Date());
  const [exerciseRows, setExerciseRows] = useState<ManualExerciseRow[]>([
    createEmptyManualExerciseRow(1),
  ]);
  const [savingWorkout, setSavingWorkout] = useState(false);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "he")),
    [clients]
  );

  const selectedClient = useMemo(
    () => sortedClients.find((client) => client.id === selectedClientId) || null,
    [sortedClients, selectedClientId]
  );

  const parsedWorkoutDate = useMemo(() => {
    const normalized = normalizeDateInputToIso(workoutDate);
    const parsed = new Date(normalized.iso);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [workoutDate]);

  const workoutDateDisplay = useMemo(() => {
    const [year, month, day] = workoutDate.split("-");
    if (year && month && day) return `${day}.${month}.${year}`;
    const normalized = normalizeDateInputToIso(workoutDate).dateKey;
    const [fallbackYear, fallbackMonth, fallbackDay] = normalized.split("-");
    return `${fallbackDay}.${fallbackMonth}.${fallbackYear}`;
  }, [workoutDate]);

  const formatPickerDateToKey = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const openDatePicker = useCallback(() => {
    const normalized = normalizeDateInputToIso(workoutDate);
    const nextDate = new Date(normalized.iso);
    setTempWorkoutDate(Number.isNaN(nextDate.getTime()) ? new Date() : nextDate);
    setShowDatePicker(true);
  }, [workoutDate]);

  const handleDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (event.type === "dismissed" || !selectedDate) return;
      setWorkoutDate(formatPickerDateToKey(selectedDate));
      return;
    }
    if (selectedDate) setTempWorkoutDate(selectedDate);
  }, [formatPickerDateToKey]);

  const confirmIosDateSelection = useCallback(() => {
    setWorkoutDate(formatPickerDateToKey(tempWorkoutDate));
    setShowDatePicker(false);
  }, [formatPickerDateToKey, tempWorkoutDate]);

  const cancelIosDateSelection = useCallback(() => setShowDatePicker(false), []);

  const updateExerciseName = useCallback((rowId: string, value: string) => {
    setExerciseRows((prev) => prev.map((row) => row.id === rowId ? { ...row, exerciseName: value } : row));
  }, []);

  const updateExerciseSet = useCallback((rowId: string, setId: string, field: "reps" | "weight", value: string) => {
    const cleanedValue = field === "reps" ? value.replace(/[^0-9]/g, "") : value.replace(/[^0-9.]/g, "");
    setExerciseRows((prev) => prev.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        sets: row.sets.map((set) => set.id === setId ? { ...set, [field]: cleanedValue } : set),
      };
    }));
  }, []);

  const addSetToExercise = useCallback((rowId: string) => {
    setExerciseRows((prev) => prev.map((row) => {
      if (row.id !== rowId) return row;
      if ((row.sets || []).length >= 10) {
        Alert.alert("שגיאה", "לא ניתן להוסיף יותר מ-10 סטים לתרגיל");
        return row;
      }
      return {
        ...row,
        sets: [...(row.sets || []), createEmptyManualExerciseSetRow((row.sets || []).length + 1)],
      };
    }));
  }, []);

  const removeSetFromExercise = useCallback((rowId: string, setId: string) => {
    setExerciseRows((prev) => prev.map((row) => {
      if (row.id !== rowId) return row;
      if ((row.sets || []).length <= 1) return { ...row, sets: [createEmptyManualExerciseSetRow(1)] };
      return { ...row, sets: normalizeManualSetOrder(row.sets.filter((set) => set.id !== setId)) };
    }));
  }, []);

  const addExerciseRow = useCallback(() => {
    setExerciseRows((prev) => [...prev, createEmptyManualExerciseRow(prev.length + 1)]);
  }, []);

  const removeExerciseRow = useCallback((rowId: string) => {
    setExerciseRows((prev) => {
      if (prev.length <= 1) return [createEmptyManualExerciseRow(1)];
      return normalizeManualExerciseOrder(prev.filter((row) => row.id !== rowId));
    });
  }, []);

  const resetForm = useCallback(() => {
    setSelectedClientId("");
    setWorkoutDate(getTodayDateInputValue());
    setShowDatePicker(false);
    setTempWorkoutDate(new Date());
    setExerciseRows([createEmptyManualExerciseRow(1)]);
  }, []);

  const handleSaveManualWorkout = useCallback(async () => {
    if (!selectedClient) return Alert.alert("שגיאה", "יש לבחור לקוח לפני שמירה");
    const targetUid = getClientResolvedUid(selectedClient);
    if (!targetUid) return Alert.alert("שגיאה", "לא נמצא מזהה תקין ללקוח");

    const filteredRows = normalizeManualExerciseOrder(exerciseRows)
      .map((row) => ({
        ...row,
        exerciseName: row.exerciseName.trim(),
        sets: normalizeManualSetOrder(row.sets || [])
          .map((set) => ({ ...set, reps: String(set.reps || "").trim(), weight: String(set.weight || "").trim() }))
          .filter((set) => set.reps || set.weight),
      }))
      .filter((row) => row.exerciseName || row.sets.length > 0);

    if (filteredRows.length === 0) return Alert.alert("שגיאה", "יש להזין לפחות תרגיל אחד");
    if (filteredRows.some((row) => !row.exerciseName)) return Alert.alert("שגיאה", "יש להזין שם תרגיל בכל תרגיל שממלאים");
    if (filteredRows.some((row) => row.sets.length === 0)) return Alert.alert("שגיאה", "יש להזין לפחות סט אחד בכל תרגיל");

    try {
      setSavingWorkout(true);
      const nowIso = new Date().toISOString();
      const normalizedDate = normalizeDateInputToIso(workoutDate);
      const enteredByUid = String(auth.currentUser?.uid || currentUserData?.authUid || currentUserData?.uid || "").trim();
      const enteredByName = String(currentUserData?.name || "").trim();

      await Promise.all(filteredRows.map(async (row) => {
        const repsPerSet = row.sets.reduce<Record<string, { reps: string; weight: string }>>((acc, set, index) => {
          acc[String(index)] = { reps: set.reps, weight: set.weight };
          return acc;
        }, {});
        const repsText = row.sets.map((set) => set.reps).filter(Boolean).join(", ");
        const weightText = row.sets.map((set) => set.weight).filter(Boolean).join(", ");

        const workoutPayload = {
          uid: targetUid,
          title: row.exerciseName,
          name: row.exerciseName,
          exerciseName: row.exerciseName,
          date: normalizedDate.iso,
          dateKey: normalizedDate.dateKey,
          note: "",
          notes: "",
          numSets: String(row.sets.length),
          repsPerSet,
          sets: String(row.sets.length),
          reps: repsText,
          weight: weightText,
          exerciseOrder: row.order,
          order: row.order,
          exerciseCount: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          enteredByCoach: true,
          enteredByManager: true,
          enteredManuallyByCoach: true,
          enteredByUid,
          enteredByName,
          clientId: selectedClient.id,
          clientUid: targetUid,
          clientName: selectedClient.name || "",
        };

        const workoutRef = await addDoc(collection(db, "workouts"), workoutPayload);
        await addDoc(collection(db, "exercises"), {
          ...workoutPayload,
          workoutId: workoutRef.id,
        });
      }));

      Alert.alert("נשמר בהצלחה", "האימון הידני נשמר ללקוח לפי תרגילים וסטים נפרדים");
      resetForm();
      await onAfterSave?.();
    } catch (error) {
      console.error("שגיאה בשמירת אימון ידני:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור את האימון הידני");
    } finally {
      setSavingWorkout(false);
    }
  }, [selectedClient, exerciseRows, workoutDate, currentUserData, onAfterSave, resetForm]);

  return (
    <View style={styles.manualWorkoutCard}>
      <View style={styles.manualWorkoutHeader}>
        <Text style={styles.manualWorkoutTitle}>הזנת אימון ידני ללקוח</Text>
        <Text style={styles.manualWorkoutSubtitle}>כאן המאמן יכול להזין תרגילים עם סטים נפרדים, וכל סט עם חזרות ומשקל משלו</Text>
      </View>

      {sortedClients.length === 0 ? (
        <View style={styles.emptyClientsBox}><Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text></View>
      ) : (
        <>
          <Text style={styles.manualWorkoutSectionLabel}>בחירת לקוח</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.manualWorkoutClientsScroll}>
            {sortedClients.map((client) => {
              const isSelected = client.id === selectedClientId;
              return (
                <Pressable key={`manual-client-${client.id}`} onPress={() => setSelectedClientId(client.id)} style={({ pressed }) => [styles.manualWorkoutClientPill, isSelected && styles.manualWorkoutClientPillActive, pressed && styles.pressed]}>
                  <Text style={[styles.manualWorkoutClientPillText, isSelected && styles.manualWorkoutClientPillTextActive]} numberOfLines={1}>{client.name || "ללא שם"}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.manualWorkoutFormBox}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>תאריך האימון</Text>
              <Pressable onPress={openDatePicker} style={({ pressed }) => [styles.datePickerButton, pressed && styles.pressedLight]}><Text style={styles.datePickerButtonText}>{workoutDateDisplay}</Text></Pressable>
              {showDatePicker && Platform.OS === "android" && <DateTimePicker value={parsedWorkoutDate} mode="date" display="calendar" onChange={handleDateChange} />}
              <Modal visible={showDatePicker && Platform.OS === "ios"} transparent animationType="fade" onRequestClose={cancelIosDateSelection}>
                <View style={styles.dateModalOverlay}><View style={styles.dateModalCard}>
                  <Text style={styles.dateModalTitle}>בחירת תאריך אימון</Text>
                  <DateTimePicker value={tempWorkoutDate} mode="date" display="spinner" onChange={handleDateChange} style={styles.iosDatePicker} />
                  <View style={styles.dateModalButtonsRow}>
                    <Pressable onPress={cancelIosDateSelection} style={({ pressed }) => [styles.dateModalSecondaryButton, pressed && styles.pressedLight]}><Text style={styles.dateModalSecondaryButtonText}>ביטול</Text></Pressable>
                    <Pressable onPress={confirmIosDateSelection} style={({ pressed }) => [styles.dateModalPrimaryButton, pressed && styles.pressed]}><Text style={styles.dateModalPrimaryButtonText}>אישור</Text></Pressable>
                  </View>
                </View></View>
              </Modal>
            </View>

            <View style={styles.manualWorkoutExercisesHeader}><Text style={styles.manualWorkoutSectionLabel}>תרגילים</Text></View>
            <View style={styles.manualExerciseList}>
              {exerciseRows.map((row, index) => (
                <View key={row.id} style={styles.manualExerciseCard}>
                  <View style={styles.manualExerciseCardTopRow}>
                    <Text style={styles.manualExerciseCardTitle}>תרגיל {row.order || index + 1}</Text>
                    <Pressable onPress={() => removeExerciseRow(row.id)} style={({ pressed }) => [styles.removeExerciseRowButton, pressed && styles.deletePressed]}><Text style={styles.removeExerciseRowButtonText}>הסרה</Text></Pressable>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>שם התרגיל</Text>
                    <TextInput value={row.exerciseName} onChangeText={(value) => updateExerciseName(row.id, value)} placeholder="לדוגמה: סקוואט" placeholderTextColor="#94A3B8" style={styles.input} textAlign="right" />
                  </View>
                  <View style={styles.manualSetsHeaderRow}>
                    <Text style={styles.manualWorkoutSectionLabel}>סטים</Text>
                    <Pressable onPress={() => addSetToExercise(row.id)} disabled={savingWorkout} style={({ pressed }) => [styles.addSetButton, pressed && styles.pressedLight, savingWorkout && styles.disabledButton]}><Text style={styles.addSetButtonText}>הוספת סט</Text></Pressable>
                  </View>
                  <View style={styles.manualSetsList}>
                    {(row.sets || []).map((set) => (
                      <View key={set.id} style={styles.manualSetCard}>
                        <View style={styles.manualSetCardHeader}>
                          <Text style={styles.manualSetTitle}>סט {set.order}</Text>
                          <Pressable onPress={() => removeSetFromExercise(row.id, set.id)} style={({ pressed }) => [styles.removeSetButton, pressed && styles.deletePressed]}><Text style={styles.removeSetButtonText}>הסרת סט</Text></Pressable>
                        </View>
                        <View style={styles.manualExerciseStatsRow}>
                          <View style={styles.manualExerciseStatCol}>
                            <Text style={styles.inputLabel}>משקל</Text>
                            <TextInput value={set.weight} onChangeText={(value) => updateExerciseSet(row.id, set.id, "weight", value)} placeholder="ק״ג" placeholderTextColor="#94A3B8" style={styles.input} textAlign="right" keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "decimal-pad"} />
                          </View>
                          <View style={styles.manualExerciseStatCol}>
                            <Text style={styles.inputLabel}>חזרות</Text>
                            <TextInput value={set.reps} onChangeText={(value) => updateExerciseSet(row.id, set.id, "reps", value)} placeholder="12" placeholderTextColor="#94A3B8" style={styles.input} textAlign="right" keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"} />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Pressable onPress={addExerciseRow} disabled={savingWorkout} style={({ pressed }) => [styles.addExerciseRowButtonBelowSave, pressed && styles.pressedLight, savingWorkout && styles.disabledButton]}><Text style={styles.addExerciseRowButtonText}>הוספת תרגיל</Text></Pressable>
            <Pressable onPress={handleSaveManualWorkout} disabled={savingWorkout} style={({ pressed }) => [styles.saveManualWorkoutButton, pressed && styles.pressed, savingWorkout && styles.disabledButton]}>{savingWorkout ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveManualWorkoutButtonText}>שמור אימון ידני</Text>}</Pressable>
            <Pressable onPress={resetForm} disabled={savingWorkout} style={({ pressed }) => [styles.clearManualWorkoutButton, pressed && styles.pressedLight, savingWorkout && styles.disabledButton]}><Text style={[styles.clearManualWorkoutButtonText, { fontSize: isSmallScreen ? 13 : 14 }]}>ניקוי הטופס</Text></Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function CardPurchaseHistoryView({
  purchases,
  onDeleteUsage,
  onUpdateUsage,
  updating = false,
}: {
  purchases: CardPurchase[];
  onDeleteUsage?: (purchaseId: string, usageDate: string) => Promise<void> | void;
  onUpdateUsage?: (
    purchaseId: string,
    oldUsageDate: string,
    nextUsageDate: string
  ) => Promise<void> | void;
  updating?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [openPurchaseIds, setOpenPurchaseIds] = useState<Record<string, boolean>>({});
  const [editingUsage, setEditingUsage] = useState<{
    purchaseId: string;
    usageDate: string;
    purchaseNumber: number;
  } | null>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const purchasesNewestFirst = useMemo(() => {
    const chronologicalPurchases = [...purchases].sort(
      (a, b) =>
        (new Date(a.purchasedAt).getTime() || 0) -
        (new Date(b.purchasedAt).getTime() || 0)
    );

    const purchaseNumberById = chronologicalPurchases.reduce<Record<string, number>>(
      (acc, purchase, index) => {
        acc[purchase.id] = index + 1;
        return acc;
      },
      {}
    );

    return [...purchases]
      .sort(
        (a, b) =>
          (new Date(b.purchasedAt).getTime() || 0) -
          (new Date(a.purchasedAt).getTime() || 0)
      )
      .map((purchase) => ({
        purchase,
        purchaseNumber: purchaseNumberById[purchase.id] || 1,
      }));
  }, [purchases]);

  const togglePurchase = useCallback((purchaseId: string) => {
    setOpenPurchaseIds((prev) => ({
      ...prev,
      [purchaseId]: !prev[purchaseId],
    }));
  }, []);

  const formatDateOnly = useCallback((value: Date) => {
    const day = `${value.getDate()}`.padStart(2, "0");
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const year = value.getFullYear();
    return `${day}.${month}.${year}`;
  }, []);

  const formatTimeOnly = useCallback((value: Date) => {
    const hours = `${value.getHours()}`.padStart(2, "0");
    const minutes = `${value.getMinutes()}`.padStart(2, "0");
    return `${hours}:${minutes}`;
  }, []);

  const openEditUsage = useCallback(
    (purchaseId: string, usageDate: string, purchaseNumber: number) => {
      const parsed = new Date(usageDate);
      setEditingUsage({
        purchaseId,
        usageDate,
        purchaseNumber,
      });
      setEditDate(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
      setShowEditDatePicker(false);
      setShowEditTimePicker(false);
    },
    []
  );

  const closeEditUsage = useCallback(() => {
    if (savingEdit) return;
    setEditingUsage(null);
    setShowEditDatePicker(false);
    setShowEditTimePicker(false);
  }, [savingEdit]);

  const handleEditDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowEditDatePicker(false);
        if (event.type === "dismissed" || !selectedDate) return;
      }

      if (!selectedDate) return;

      setEditDate((prev) => {
        const next = new Date(prev);
        next.setFullYear(selectedDate.getFullYear());
        next.setMonth(selectedDate.getMonth());
        next.setDate(selectedDate.getDate());
        return next;
      });
    },
    []
  );

  const handleEditTimeChange = useCallback(
    (event: DateTimePickerEvent, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowEditTimePicker(false);
        if (event.type === "dismissed" || !selectedTime) return;
      }

      if (!selectedTime) return;

      setEditDate((prev) => {
        const next = new Date(prev);
        next.setHours(selectedTime.getHours());
        next.setMinutes(selectedTime.getMinutes());
        next.setSeconds(0);
        next.setMilliseconds(0);
        return next;
      });
    },
    []
  );

  const handleSaveUsageEdit = useCallback(async () => {
    if (!editingUsage || !onUpdateUsage) return;

    try {
      setSavingEdit(true);
      await onUpdateUsage(
        editingUsage.purchaseId,
        editingUsage.usageDate,
        editDate.toISOString()
      );
      setEditingUsage(null);
      setShowEditDatePicker(false);
      setShowEditTimePicker(false);
    } finally {
      setSavingEdit(false);
    }
  }, [editDate, editingUsage, onUpdateUsage]);

  const handleDeleteUsagePress = useCallback(
    async (purchaseId: string, usageDate: string) => {
      if (!onDeleteUsage || updating) return;

      const runDelete = async () => {
        try {
          await onDeleteUsage(purchaseId, usageDate);
        } catch (error) {
          console.error("שגיאה במחיקת מימוש כרטיסייה:", error);
          Alert.alert("שגיאה", "לא ניתן למחוק את המימוש");
        }
      };

      if (Platform.OS === "web") {
        const confirmed = window.confirm("האם למחוק את המימוש הזה?");
        if (confirmed) await runDelete();
        return;
      }

      Alert.alert("מחיקת מימוש", "האם למחוק את המימוש הזה?", [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחיקה",
          style: "destructive",
          onPress: runDelete,
        },
      ]);
    },
    [onDeleteUsage, updating]
  );

  if (purchases.length === 0) {
    return (
      <View style={styles.emptyCardHistoryBox}>
        <Text style={styles.emptyCardHistoryText}>עדיין לא נרכשו כרטיסיות</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.cardPurchaseGroupsList}>
        {purchasesNewestFirst.map(({ purchase, purchaseNumber }) => {
          const isOpen = !!openPurchaseIds[purchase.id];
          const usedCount = purchase.usageDates.length;
          const remainingCount = Math.max(purchase.purchasedCount - usedCount, 0);
          const sortedUsageDates = sortIsoDatesDesc(purchase.usageDates || []);

          return (
            <View key={purchase.id} style={styles.cardPurchaseGroupCard}>
              <Pressable
                onPress={() => togglePurchase(purchase.id)}
                style={({ pressed }) => [
                  styles.cardPurchaseGroupHeaderPressable,
                  pressed && styles.pressedLight,
                ]}
              >
                <View style={styles.cardPurchaseGroupHeader}>
                  <View style={styles.cardPurchaseGroupTitleWrap}>
                    <Text style={styles.cardPurchaseGroupTitle}>רכישה {purchaseNumber}</Text>
                    <Text style={styles.cardPurchaseGroupDate}>{formatDateTimeIL(purchase.purchasedAt)}</Text>
                  </View>
                  <View style={styles.cardPurchaseGroupBadge}>
                    <Text style={styles.cardPurchaseGroupBadgeText}>{purchase.purchasedCount}</Text>
                  </View>
                </View>

                <View style={styles.cardPurchaseClosedSummaryRow}>
                  <Text style={styles.cardPurchaseClosedSummaryText}>
                    {purchase.purchasedCount} נרכשו · {usedCount} מומשו · {remainingCount} נותרו
                  </Text>
                  <Text style={styles.cardPurchaseToggleText}>{isOpen ? "סגירה" : "פתיחה"}</Text>
                </View>
              </Pressable>

              {isOpen && (
                <>
                  <View style={styles.cardPurchaseMiniStatsRow}>
                    <View style={styles.cardPurchaseMiniStatBox}>
                      <Text style={styles.cardPurchaseMiniStatValue}>{purchase.purchasedCount}</Text>
                      <Text style={styles.cardPurchaseMiniStatLabel}>נרכשו</Text>
                    </View>
                    <View style={styles.cardPurchaseMiniStatBox}>
                      <Text style={styles.cardPurchaseMiniStatValue}>{usedCount}</Text>
                      <Text style={styles.cardPurchaseMiniStatLabel}>מומשו</Text>
                    </View>
                    <View style={styles.cardPurchaseMiniStatBox}>
                      <Text style={styles.cardPurchaseMiniStatValue}>{remainingCount}</Text>
                      <Text style={styles.cardPurchaseMiniStatLabel}>נותרו</Text>
                    </View>
                  </View>

                  <View style={styles.cardPurchaseUsageSection}>
                    <View style={styles.cardUsageHistoryHeader}>
                      <Text style={styles.cardUsageHistoryTitle}>מימושים של רכישה {purchaseNumber}</Text>
                      <Text style={styles.cardUsageHistoryCount}>{usedCount} מימושים</Text>
                    </View>

                    {sortedUsageDates.length === 0 ? (
                      <View style={styles.emptyCardHistoryBox}>
                        <Text style={styles.emptyCardHistoryText}>עדיין לא בוצע מימוש ברכישה הזו</Text>
                      </View>
                    ) : (
                      <View style={styles.cardUsageList}>
                        {sortedUsageDates.map((usageDate, usageIndex) => (
                          <View key={`${purchase.id}-${usageDate}-${usageIndex}`} style={styles.cardUsageRow}>
                            <View style={styles.cardUsageOrderBadge}>
                              <Text style={styles.cardUsageOrderBadgeText}>{usedCount - usageIndex}</Text>
                            </View>

                            <View style={styles.cardUsageContent}>
                              <Text style={styles.cardUsageMainText}>מימוש מתוך רכישה {purchaseNumber}</Text>
                              <Text style={styles.cardUsageSubText}>{formatDateTimeIL(usageDate)}</Text>

                              {(onDeleteUsage || onUpdateUsage) && (
                                <View style={styles.cardUsageActionsRow}>
                                  {onUpdateUsage && (
                                    <Pressable
                                      onPress={() => openEditUsage(purchase.id, usageDate, purchaseNumber)}
                                      disabled={updating}
                                      style={({ pressed }) => [
                                        styles.editUsageButton,
                                        pressed && styles.pressedLight,
                                        updating && styles.disabledButton,
                                      ]}
                                    >
                                      <Text style={styles.editUsageButtonText}>שינוי תאריך/שעה</Text>
                                    </Pressable>
                                  )}

                                  {onDeleteUsage && (
                                    <Pressable
                                      onPress={() => handleDeleteUsagePress(purchase.id, usageDate)}
                                      disabled={updating}
                                      style={({ pressed }) => [
                                        styles.deleteUsageButton,
                                        pressed && styles.deletePressed,
                                        updating && styles.disabledButton,
                                      ]}
                                    >
                                      <Text style={styles.deleteUsageButtonText}>מחיקת מימוש</Text>
                                    </Pressable>
                                  )}
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>

      <Modal
        visible={!!editingUsage}
        transparent
        animationType="fade"
        onRequestClose={closeEditUsage}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editUsageModalCard, { maxWidth: Math.min(width - 32, 390) }]}>
            <Text style={styles.editUsageModalTitle}>
              שינוי מימוש רכישה {editingUsage?.purchaseNumber || ""}
            </Text>
            <Text style={styles.editUsageModalSubtitle}>
              לחצי על התאריך כדי לפתוח יומן, ועל השעה כדי לפתוח גלגלת שעה
            </Text>

            <View style={styles.editUsagePickerRow}>
              <View style={styles.editUsagePickerCol}>
                <Text style={styles.inputLabel}>תאריך</Text>
                {Platform.OS === "web" ? (
                  <WebDateTimeInput
                    type="date"
                    value={dateToDateInputValue(editDate)}
                    onChange={(value) => {
                      if (!value) return;
                      const nextDate = new Date(createLocalDateTimeIso(value, dateToTimeInputValue(editDate)));
                      if (!Number.isNaN(nextDate.getTime())) setEditDate(nextDate);
                    }}
                  />
                ) : (
                  <>
                    <Pressable
                      onPress={() => {
                        setShowEditTimePicker(false);
                        setShowEditDatePicker((prev) => !prev);
                      }}
                      style={({ pressed }) => [styles.editUsagePickerButton, pressed && styles.pressedLight]}
                    >
                      <Text style={styles.editUsagePickerButtonText} numberOfLines={1}>{formatDateOnly(editDate)}</Text>
                    </Pressable>
                    {showEditDatePicker && (
                      <DateTimePicker
                        value={editDate}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "calendar"}
                        onChange={handleEditDateChange}
                        style={styles.inlineDateTimePicker}
                      />
                    )}
                  </>
                )}
              </View>

              <View style={styles.editUsagePickerCol}>
                <Text style={styles.inputLabel}>שעה</Text>
                {Platform.OS === "web" ? (
                  <WebDateTimeInput
                    type="time"
                    value={dateToTimeInputValue(editDate)}
                    onChange={(value) => {
                      if (!value) return;
                      const nextDate = new Date(createLocalDateTimeIso(dateToDateInputValue(editDate), value));
                      if (!Number.isNaN(nextDate.getTime())) setEditDate(nextDate);
                    }}
                  />
                ) : (
                  <>
                    <Pressable
                      onPress={() => {
                        setShowEditDatePicker(false);
                        setShowEditTimePicker((prev) => !prev);
                      }}
                      style={({ pressed }) => [styles.editUsagePickerButton, pressed && styles.pressedLight]}
                    >
                      <Text style={styles.editUsagePickerButtonText} numberOfLines={1}>{formatTimeOnly(editDate)}</Text>
                    </Pressable>
                    {showEditTimePicker && (
                      <DateTimePicker
                        value={editDate}
                        mode="time"
                        display="spinner"
                        is24Hour
                        onChange={handleEditTimeChange}
                        style={styles.inlineDateTimePicker}
                      />
                    )}
                  </>
                )}
              </View>
            </View>

            <View style={styles.editUsageModalButtonsRow}>
              <Pressable
                onPress={closeEditUsage}
                disabled={savingEdit}
                style={({ pressed }) => [
                  styles.dateModalSecondaryButton,
                  pressed && styles.pressedLight,
                  savingEdit && styles.disabledButton,
                ]}
              >
                <Text style={styles.dateModalSecondaryButtonText}>ביטול</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveUsageEdit}
                disabled={savingEdit || updating}
                style={({ pressed }) => [
                  styles.dateModalPrimaryButton,
                  pressed && styles.pressed,
                  (savingEdit || updating) && styles.disabledButton,
                ]}
              >
                {savingEdit || updating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.dateModalPrimaryButtonText}>שמירה</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
function ClientCardRenewalManager({
  clients,
  currentUserData,
  onAfterUpdate,
}: {
  clients: ClientItem[];
  currentUserData: CurrentUserData | null;
  onAfterUpdate?: () => Promise<void> | void;
}) {
  const { width } = useWindowDimensions();
  const [localClients, setLocalClients] = useState<ClientItem[]>(clients);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [redeemDate, setRedeemDate] = useState(getTodayDateInputValue());
  const [redeemTime, setRedeemTime] = useState("12:00");
  const [updatingClient, setUpdatingClient] = useState(false);

  void onAfterUpdate;

  useEffect(() => {
    setLocalClients(clients);
  }, [clients]);

  const sortedClients = useMemo(
    () => [...localClients].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "he")),
    [localClients]
  );

  const selectedClient = useMemo(
    () => sortedClients.find((client) => client.id === selectedClientId) || null,
    [sortedClients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const queryValue = clientSearchQuery.trim().toLowerCase();
    if (!queryValue) return [] as ClientItem[];

    return sortedClients
      .filter((client) => {
        const name = String(client.name || "").toLowerCase();
        const email = String(client.email || "").toLowerCase();
        const phone = String(client.phone || "").toLowerCase();
        return name.includes(queryValue) || email.includes(queryValue) || phone.includes(queryValue);
      })
      .slice(0, 8);
  }, [clientSearchQuery, sortedClients]);

  const selectedStats = useMemo(() => getCardPurchaseStats(selectedClient), [selectedClient]);
  const canAddNewPurchase = !!selectedClient && selectedStats.totalRemaining === 0;
  const canRedeemCard = !!selectedClient && selectedStats.totalRemaining > 0;

  const syncLegacyTotals = useCallback((purchases: CardPurchase[], updatedAt: string) => {
    return buildCardFirestorePayload(purchases, updatedAt);
  }, []);

  const applyCardPurchaseUpdate = useCallback(
    async (nextPurchases: CardPurchase[], updatedAt: string) => {
      if (!selectedClient) throw new Error("missing selected client");

      const payload = syncLegacyTotals(nextPurchases, updatedAt);
      await updateDoc(doc(db, "users", selectedClient.id), payload);

      setLocalClients((prev) =>
        prev.map((client) =>
          client.id === selectedClient.id
            ? {
                ...client,
                ...payload,
              }
            : client
        )
      );

      return payload;
    },
    [selectedClient, syncLegacyTotals]
  );

  const handleSelectClient = useCallback((client: ClientItem) => {
    setSelectedClientId(client.id);
    setClientSearchQuery(String(client.name || client.email || client.phone || ""));
    setPurchaseAmount("");
  }, []);

  const handleAddPurchase = useCallback(async () => {
    if (!selectedClient) return Alert.alert("שגיאה", "יש לבחור לקוח לפני הוספת רכישה");

    if (selectedStats.totalRemaining > 0) {
      return Alert.alert("לא ניתן לחדש עדיין", "כפתור חידוש כרטיסייה מופיע רק אחרי שכל הכרטיסיות הקיימות מומשו");
    }

    const amount = Number(String(purchaseAmount || "").replace(/[^0-9]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      return Alert.alert("שגיאה", "יש להזין כמות כרטיסיות תקינה");
    }

    try {
      setUpdatingClient(true);
      const nowIso = new Date().toISOString();
      const purchases = normalizeCardPurchases(selectedClient);
      const nextPurchases = [
        ...purchases,
        {
          id: createCardPurchaseId(),
          purchasedCount: amount,
          purchasedAt: nowIso,
          updatedAt: nowIso,
          createdByUid: String(auth.currentUser?.uid || currentUserData?.authUid || currentUserData?.uid || "").trim(),
          createdByName: String(currentUserData?.name || "").trim(),
          usageDates: [],
        },
      ];

      await applyCardPurchaseUpdate(nextPurchases, nowIso);
      setPurchaseAmount("");
      Alert.alert("נשמר בהצלחה", `נוספה רכישה חדשה של ${amount} כרטיסיות`);
    } catch (error) {
      console.error("שגיאה בהוספת רכישת כרטיסיות:", error);
      Alert.alert("שגיאה", "לא ניתן להוסיף רכישת כרטיסיות");
    } finally {
      setUpdatingClient(false);
    }
  }, [applyCardPurchaseUpdate, currentUserData, purchaseAmount, selectedClient, selectedStats.totalRemaining]);

  const handleRedeemCard = useCallback(async () => {
    if (!selectedClient) return Alert.alert("שגיאה", "יש לבחור לקוח לפני מימוש");

    const purchases = normalizeCardPurchases(selectedClient);
    const purchaseIndex = purchases.findIndex(
      (purchase) => purchase.usageDates.length < purchase.purchasedCount
    );

    if (purchaseIndex < 0) {
      return Alert.alert("אין כרטיסיות זמינות", "יש לחדש כרטיסייה לפני שניתן לבצע מימוש נוסף");
    }

    try {
      setUpdatingClient(true);
      const nowIso = new Date().toISOString();
      const usageIso = createLocalDateTimeIso(redeemDate, redeemTime);
      const nextPurchases = purchases.map((purchase, index) => {
        if (index !== purchaseIndex) return purchase;
        return {
          ...purchase,
          updatedAt: nowIso,
          usageDates: sortIsoDatesDesc([usageIso, ...(purchase.usageDates || [])]),
        };
      });

      await applyCardPurchaseUpdate(nextPurchases, nowIso);
      Alert.alert("נשמר בהצלחה", `בוצע מימוש מתוך רכישה ${purchaseIndex + 1}`);
    } catch (error) {
      console.error("שגיאה במימוש כרטיסייה:", error);
      Alert.alert("שגיאה", "לא ניתן לממש כרטיסייה");
    } finally {
      setUpdatingClient(false);
    }
  }, [applyCardPurchaseUpdate, redeemDate, redeemTime, selectedClient]);

  const handleDeleteUsage = useCallback(async (purchaseId: string, usageDate: string) => {
    if (!selectedClient) return Alert.alert("שגיאה", "יש לבחור לקוח לפני מחיקת מימוש");

    try {
      setUpdatingClient(true);
      const nowIso = new Date().toISOString();
      const purchases = normalizeCardPurchases(selectedClient);

      const nextPurchases = purchases.map((purchase) => {
        if (purchase.id !== purchaseId) return purchase;

        let removed = false;
        const nextUsageDates = (purchase.usageDates || []).filter((date) => {
          if (!removed && date === usageDate) {
            removed = true;
            return false;
          }
          return true;
        });

        return {
          ...purchase,
          updatedAt: nowIso,
          usageDates: sortIsoDatesDesc(nextUsageDates),
        };
      });

      await applyCardPurchaseUpdate(nextPurchases, nowIso);
      Alert.alert("נמחק בהצלחה", "המימוש נמחק והסיכומים עודכנו");
    } catch (error) {
      console.error("שגיאה במחיקת מימוש כרטיסייה:", error);
      Alert.alert("שגיאה", "לא ניתן למחוק את המימוש");
    } finally {
      setUpdatingClient(false);
    }
  }, [applyCardPurchaseUpdate, selectedClient]);

  const handleUpdateUsage = useCallback(async (
    purchaseId: string,
    oldUsageDate: string,
    nextUsageDate: string
  ) => {
    if (!selectedClient) return Alert.alert("שגיאה", "יש לבחור לקוח לפני עדכון מימוש");

    try {
      setUpdatingClient(true);
      const nowIso = new Date().toISOString();
      const purchases = normalizeCardPurchases(selectedClient);

      const nextPurchases = purchases.map((purchase) => {
        if (purchase.id !== purchaseId) return purchase;

        let updated = false;
        const nextUsageDates = (purchase.usageDates || []).map((date) => {
          if (!updated && date === oldUsageDate) {
            updated = true;
            return nextUsageDate;
          }
          return date;
        });

        return {
          ...purchase,
          updatedAt: nowIso,
          usageDates: sortIsoDatesDesc(nextUsageDates),
        };
      });

      await applyCardPurchaseUpdate(nextPurchases, nowIso);
      Alert.alert("עודכן בהצלחה", "תאריך ושעת המימוש עודכנו");
    } catch (error) {
      console.error("שגיאה בעדכון מימוש כרטיסייה:", error);
      Alert.alert("שגיאה", "לא ניתן לעדכן את המימוש");
    } finally {
      setUpdatingClient(false);
    }
  }, [applyCardPurchaseUpdate, selectedClient]);

  return (
    <View style={styles.cardRenewalManagerCard}>
      <View style={styles.clientCardsHeader}>
        <Text style={styles.clientCardsInfoTitle}>מימוש וחידוש כרטיסיות</Text>
        <Text style={styles.clientCardsInfoSubtitle}>
          כל חידוש נשמר כרכישה נפרדת, והמימושים מוצגים מתחת לרכישה שאליה הם שייכים
        </Text>
      </View>

      {sortedClients.length === 0 ? (
        <View style={styles.emptyClientsBox}>
          <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
        </View>
      ) : (
        <>
          <View style={styles.clientSearchBox}>
            <Text style={styles.manualWorkoutSectionLabel}>חיפוש לקוח</Text>
            <TextInput
              value={clientSearchQuery}
              onChangeText={(value) => {
                setClientSearchQuery(value);
                if (!value.trim()) setSelectedClientId("");
              }}
              placeholder="הקלידי שם, אימייל או טלפון"
              placeholderTextColor="#94A3B8"
              style={styles.clientSearchInput}
              textAlign="right"
              autoCapitalize="none"
            />

            {clientSearchQuery.trim().length > 0 && filteredClients.length > 0 && (
              <View style={styles.clientSearchResultsList}>
                {filteredClients.map((client) => {
                  const isSelected = client.id === selectedClientId;
                  return (
                    <Pressable
                      key={`card-search-client-${client.id}`}
                      onPress={() => handleSelectClient(client)}
                      style={({ pressed }) => [
                        styles.clientSearchResultItem,
                        isSelected && styles.clientSearchResultItemActive,
                        pressed && styles.pressedLight,
                      ]}
                    >
                      <Text style={styles.clientSearchResultName} numberOfLines={1}>
                        {client.name || "ללא שם"}
                      </Text>
                      {!!client.email && (
                        <Text style={styles.clientSearchResultMeta} numberOfLines={1}>
                          {client.email}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {clientSearchQuery.trim().length > 0 && filteredClients.length === 0 && (
              <View style={styles.emptyCardHistoryBox}>
                <Text style={styles.emptyCardHistoryText}>לא נמצא לקוח מתאים לחיפוש</Text>
              </View>
            )}
          </View>

          {selectedClient && (
            <View style={styles.cardRenewalSelectedBox}>
              <View style={styles.selectedClientSummaryBox}>
                <Text style={styles.selectedClientSummaryTitle}>{selectedClient.name || "ללא שם"}</Text>
                <Text style={styles.selectedClientSummaryMeta}>{selectedClient.email || selectedClient.phone || "לקוח נבחר"}</Text>
              </View>

              <View style={styles.clientCardsTopStatsRow}>
                <View style={styles.clientCardsMiniStatBox}>
                  <Text style={styles.clientCardsMiniValue}>{selectedStats.totalPurchased}</Text>
                  <Text style={styles.clientCardsMiniLabel}>סה״כ נרכשו</Text>
                </View>
                <View style={styles.clientCardsMiniStatBox}>
                  <Text style={styles.clientCardsMiniValue}>{selectedStats.totalUsed}</Text>
                  <Text style={styles.clientCardsMiniLabel}>סה״כ מומשו</Text>
                </View>
                <View style={styles.clientCardsMiniStatBox}>
                  <Text style={styles.clientCardsMiniValue}>{selectedStats.totalRemaining}</Text>
                  <Text style={styles.clientCardsMiniLabel}>סה״כ נותרו</Text>
                </View>
              </View>

              <View style={styles.cardRenewalFormBox}>
                {canRedeemCard && (
                  <>
                    <View style={styles.editUsagePickerRow}>
                      <View style={styles.editUsagePickerCol}>
                        <Text style={styles.inputLabel}>תאריך מימוש</Text>
                        {Platform.OS === "web" ? (
                          <View style={styles.responsiveWebInputWrap}>
                            <WebDateTimeInput type="date" value={redeemDate} onChange={setRedeemDate} />
                          </View>
                        ) : (
                          <TextInput
                            value={redeemDate}
                            onChangeText={setRedeemDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#94A3B8"
                            style={styles.input}
                            textAlign="right"
                          />
                        )}
                      </View>

                      <View style={styles.editUsagePickerCol}>
                        <Text style={styles.inputLabel}>שעת מימוש</Text>
                        {Platform.OS === "web" ? (
                          <View style={styles.responsiveWebInputWrap}>
                            <WebDateTimeInput type="time" value={redeemTime} onChange={setRedeemTime} />
                          </View>
                        ) : (
                          <TextInput
                            value={redeemTime}
                            onChangeText={(value) => setRedeemTime(value.replace(/[^0-9:]/g, "").slice(0, 5))}
                            onBlur={() => {
                              const match = redeemTime.match(/^(\d{1,2}):(\d{1,2})$/);
                              if (!match) {
                                setRedeemTime("12:00");
                                return;
                              }
                              const hours = Math.min(Math.max(Number(match[1]), 0), 23);
                              const minutes = Math.min(Math.max(Number(match[2]), 0), 59);
                              setRedeemTime(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
                            }}
                            placeholder="12:00"
                            placeholderTextColor="#94A3B8"
                            style={styles.input}
                            keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
                            textAlign="right"
                          />
                        )}
                      </View>
                    </View>

                    <Pressable
                      onPress={handleRedeemCard}
                      disabled={updatingClient}
                      style={({ pressed }) => [styles.redeemCardButton, pressed && styles.pressedLight, updatingClient && styles.disabledButton]}
                    >
                      {updatingClient ? <ActivityIndicator color="#1D4ED8" /> : <Text style={styles.redeemCardButtonText}>מימוש כרטיסייה</Text>}
                    </Pressable>
                  </>
                )}

                {canAddNewPurchase ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>כמות כרטיסיות לרכישה חדשה</Text>
                      <TextInput
                        value={purchaseAmount}
                        onChangeText={(value) => setPurchaseAmount(value.replace(/[^0-9]/g, ""))}
                        placeholder="לדוגמה: 8"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        keyboardType="numeric"
                        textAlign="right"
                      />
                    </View>

                    <Pressable
                      onPress={handleAddPurchase}
                      disabled={updatingClient}
                      style={({ pressed }) => [styles.addCardPurchaseButton, pressed && styles.pressed, updatingClient && styles.disabledButton]}
                    >
                      {updatingClient ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addCardPurchaseButtonText}>הוספת רכישה חדשה</Text>}
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.emptyCardHistoryBox}>
                    <Text style={styles.emptyCardHistoryText}>חידוש כרטיסייה יופיע רק אחרי שכל הכרטיסיות הקיימות מומשו</Text>
                  </View>
                )}
              </View>

              <CardPurchaseHistoryView
                purchases={selectedStats.purchases}
                onDeleteUsage={handleDeleteUsage}
                onUpdateUsage={handleUpdateUsage}
                updating={updatingClient}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function Menu() {
  const { width, height } = useWindowDimensions();

  const isVerySmall = width < 340;
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;

  const dynamic = useMemo(() => {
    const horizontalPadding = isTablet ? width * 0.04 : width * 0.05;
    const cardWidth = Math.min(width * 0.94, 760);
    const titleSize = isVerySmall ? 21 : isSmallScreen ? 23 : isTablet ? 30 : 26;
    const textSize = isVerySmall ? 13 : isSmallScreen ? 14 : 16;
    const subtitleSize = isVerySmall ? 12 : isSmallScreen ? 13 : 15;
    const buttonHeight = isVerySmall ? 54 : isSmallScreen ? 58 : 62;
    const iconSize = isVerySmall ? 18 : 20;
    const cardPaddingHorizontal = isVerySmall ? 14 : isSmallScreen ? 18 : isTablet ? 30 : 22;
    const cardPaddingVertical = isVerySmall ? 18 : isTablet ? 30 : 24;
    const modalWidth = Math.min(width * 0.92, 430);

    return {
      horizontalPadding,
      cardWidth,
      titleSize,
      textSize,
      subtitleSize,
      buttonHeight,
      iconSize,
      cardPaddingHorizontal,
      cardPaddingVertical,
      modalWidth,
    };
  }, [width, isVerySmall, isSmallScreen, isTablet]);

  const [fontsLoaded] = useFonts({
    Bilbo: require("../assets/fonts/Bilbo-Regular.ttf"),
  });

  const [contactVisible, setContactVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingContactInfo, setSavingContactInfo] = useState(false);
  const [isEditingContactInfo, setIsEditingContactInfo] = useState(false);

  const [currentUserData, setCurrentUserData] = useState<CurrentUserData | null>(null);
  const [resolvedContactData, setResolvedContactData] = useState<ContactData | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [secondaryAdmins, setSecondaryAdmins] = useState<SecondaryAdminItem[]>([]);
  const [currentUserDocId, setCurrentUserDocId] = useState<string>("");

  const [instagramInput, setInstagramInput] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const [adminActionsOpen, setAdminActionsOpen] = useState(false);
  const [clientsSectionOpen, setClientsSectionOpen] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [deleteClientsOpen, setDeleteClientsOpen] = useState(false);
  const [accessManagementOpen, setAccessManagementOpen] = useState(false);
  const [trainingManagementOpen, setTrainingManagementOpen] = useState(false);
  const [secondaryAdminsOpen, setSecondaryAdminsOpen] = useState(false);
  const [clientWorkoutTrackingOpen, setClientWorkoutTrackingOpen] = useState(false);
  const [clientCardManagerOpen, setClientCardManagerOpen] = useState(false);
  const [trainingProgramManagerOpen, setTrainingProgramManagerOpen] = useState(false);
  const [manualWorkoutEntryOpen, setManualWorkoutEntryOpen] = useState(false);
  const [accessInfoOpen, setAccessInfoOpen] = useState(false);
  const [cardHistoryOpen, setCardHistoryOpen] = useState(false);
  const [clientTrainingProgramOpen, setClientTrainingProgramOpen] = useState(false);
  const [clientExerciseLibraryOpen, setClientExerciseLibraryOpen] = useState(false);
  const [managerExerciseLibraryOpen, setManagerExerciseLibraryOpen] = useState(false);

  const isOwner = currentUserData?.role === "owner";
  const isAdmin = currentUserData?.role === "admin";
  const isManager = isOwner || isAdmin;

  const fetchMenuData = useCallback(async () => {
    try {
      setLoading(true);

      const authUser = auth.currentUser;
      if (!authUser) {
        setCurrentUserData(null);
        setResolvedContactData(null);
        setClients([]);
        setSecondaryAdmins([]);
        setCurrentUserDocId("");
        return;
      }

      const resolvedUser = await resolveCurrentUserDoc();

      if (!resolvedUser) {
        setCurrentUserData(null);
        setResolvedContactData(null);
        setClients([]);
        setSecondaryAdmins([]);
        setCurrentUserDocId("");
        return;
      }

      const { docId: resolvedDocId, data: userData } = resolvedUser;

      setCurrentUserDocId(resolvedDocId);
      setCurrentUserData(userData);

      setInstagramInput(userData.instagramUrl || "");
      setWhatsappInput(userData.whatsappPhone || "");
      setPhoneInput(userData.contactPhone || userData.phone || "");

      const currentUserUidCandidates = buildUidCandidates(
        authUser.uid,
        resolvedDocId,
        userData.uid,
        userData.authUid
      );

      const ownerUidCandidates =
        userData.role === "owner"
          ? currentUserUidCandidates
          : buildUidCandidates(userData.createdByOwnerUid);

      let contactSource: ContactData = {
        instagramUrl: userData.instagramUrl,
        whatsappPhone: userData.whatsappPhone,
        contactPhone: userData.contactPhone,
        phone: userData.phone,
        name: userData.name,
        uid: resolvedDocId,
      };

      if (userData.role === "client") {
        const coachUidCandidates = buildUidCandidates(
          userData.createdByUid,
          userData.contactOwnerUid
        );

        let coachFound = false;

        for (const coachUid of coachUidCandidates) {
          try {
            const coachDirectSnap = await getDoc(doc(db, "users", coachUid));

            if (coachDirectSnap.exists()) {
              const coachData = coachDirectSnap.data() as CurrentUserData;
              contactSource = {
                instagramUrl: coachData.instagramUrl,
                whatsappPhone: coachData.whatsappPhone,
                contactPhone: coachData.contactPhone,
                phone: coachData.phone,
                name: coachData.name,
                uid: coachDirectSnap.id,
              };
              coachFound = true;
              break;
            }

            const coachByUidSnap = await getDocs(
              query(collection(db, "users"), where("uid", "==", coachUid))
            );

            if (!coachByUidSnap.empty) {
              const coachDoc = coachByUidSnap.docs[0];
              const coachData = coachDoc.data() as CurrentUserData;
              contactSource = {
                instagramUrl: coachData.instagramUrl,
                whatsappPhone: coachData.whatsappPhone,
                contactPhone: coachData.contactPhone,
                phone: coachData.phone,
                name: coachData.name,
                uid: coachDoc.id,
              };
              coachFound = true;
              break;
            }

            const coachByAuthUidSnap = await getDocs(
              query(collection(db, "users"), where("authUid", "==", coachUid))
            );

            if (!coachByAuthUidSnap.empty) {
              const coachDoc = coachByAuthUidSnap.docs[0];
              const coachData = coachDoc.data() as CurrentUserData;
              contactSource = {
                instagramUrl: coachData.instagramUrl,
                whatsappPhone: coachData.whatsappPhone,
                contactPhone: coachData.contactPhone,
                phone: coachData.phone,
                name: coachData.name,
                uid: coachDoc.id,
              };
              coachFound = true;
              break;
            }
          } catch (error) {
            console.error("שגיאה בטעינת פרטי המאמן:", error);
          }
        }

        if (!coachFound) {
          contactSource = {
            instagramUrl: userData.instagramUrl,
            whatsappPhone: userData.whatsappPhone,
            contactPhone: userData.contactPhone,
            phone: userData.phone,
            name: userData.name,
            uid: resolvedDocId,
          };
        }
      }

      setResolvedContactData(contactSource);

      if (userData.role === "owner") {
        const ownerCandidates = currentUserUidCandidates;
        const adminsList = await fetchAdminsByOwner(ownerCandidates);
        setSecondaryAdmins(adminsList);

        const ownerClients = await fetchAllClientsForOwner(ownerCandidates, adminsList);
        setClients(ownerClients);
        return;
      }

      if (userData.role === "admin") {
        const adminCandidates = currentUserUidCandidates;
        const adminClients = await fetchAllClientsForAdmin(
          adminCandidates,
          ownerUidCandidates
        );

        setClients(adminClients);
        setSecondaryAdmins([]);
        return;
      }

      setClients([]);
      setSecondaryAdmins([]);
    } catch (error) {
      console.error("שגיאה בטעינת נתוני תפריט:", error);
      setClients([]);
      setSecondaryAdmins([]);
      setCurrentUserDocId("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  const secondaryAdminClientCounts = useMemo<SecondaryAdminCountItem[]>(() => {
    if (!isOwner || secondaryAdmins.length === 0) return [];

    return secondaryAdmins.map((admin) => {
      const adminUidCandidates = buildUidCandidates(admin.uid, admin.authUid, admin.id);

      const linkedClients = uniqueClientsByUid(
        clients.filter((client) => {
          const links = buildUidCandidates(client.createdByUid, client.contactOwnerUid);
          return links.some((value) => adminUidCandidates.includes(value));
        })
      );

      return {
        adminId: String(admin.id || admin.uid || admin.authUid || ""),
        adminName: String(admin.name || "ללא שם"),
        adminEmail: String(admin.email || "ללא אימייל"),
        clientCount: linkedClients.length,
      };
    });
  }, [isOwner, secondaryAdmins, clients]);

  const trainingProgramTargets = useMemo(() => {
    const baseClients = uniqueClientsByUid(clients);

    if (!isManager || !currentUserData) {
      return baseClients;
    }

    const selfUid = String(
      currentUserData.authUid || currentUserData.uid || currentUserDocId || auth.currentUser?.uid || ""
    ).trim();

    if (!selfUid) {
      return baseClients;
    }

    const selfNameBase = String(currentUserData.name || "").trim();
    const selfRoleLabel = isOwner ? "בעלת המערכת" : "מאמן";
    const selfDisplayName = selfNameBase
      ? `${selfNameBase} (אני)`
      : `${selfRoleLabel} (אני)`;

    const selfAsClientItem: ClientItem = {
      id: currentUserDocId || selfUid,
      uid: selfUid,
      authUid: String(currentUserData.authUid || auth.currentUser?.uid || selfUid).trim(),
      name: selfDisplayName,
      email: currentUserData.email || "",
      phone: currentUserData.phone || "",
      role: currentUserData.role,
      approvalStatus: currentUserData.approvalStatus,
      accessStartAt: currentUserData.accessStartAt || null,
      accessEndAt: currentUserData.accessEndAt || null,
      createdByUid: currentUserData.createdByUid || null,
      createdByOwnerUid: currentUserData.createdByOwnerUid || null,
      hasLoginAccount: currentUserData.hasLoginAccount,
      cardsPurchased: currentUserData.cardsPurchased,
      cardsUsed: currentUserData.cardsUsed,
      cardUsageDates: currentUserData.cardUsageDates,
      cardPurchases: currentUserData.cardPurchases,
      instagramUrl: currentUserData.instagramUrl,
      whatsappPhone: currentUserData.whatsappPhone,
      contactPhone: currentUserData.contactPhone,
      contactOwnerUid: currentUserData.contactOwnerUid || null,
      contactUpdatedAt: currentUserData.contactUpdatedAt || null,
    };

    const withoutSelfDuplicate = baseClients.filter(
      (client) => getClientResolvedUid(client) !== selfUid
    );

    return uniqueClientsByUid([selfAsClientItem, ...withoutSelfDuplicate]);
  }, [clients, currentUserData, currentUserDocId, isManager, isOwner]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: APP_BG }} />;
  }

  const confirmAction = async (title: string, message: string) => {
    if (Platform.OS === "web") {
      return window.confirm(`${title}\n\n${message}`);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: "ביטול", style: "cancel", onPress: () => resolve(false) },
        { text: "אישור", onPress: () => resolve(true) },
      ]);
    });
  };

  const resolvedInstagramUrl =
    resolvedContactData?.instagramUrl?.trim() || DEFAULT_INSTAGRAM_URL;

  const resolvedWhatsappPhone =
    normalizePhoneForWhatsapp(resolvedContactData?.whatsappPhone) || DEFAULT_WHATSAPP_PHONE;

  const resolvedPhoneNumber =
    resolvedContactData?.contactPhone?.trim() ||
    resolvedContactData?.phone?.trim() ||
    DEFAULT_PHONE_NUMBER;

  const openContactModal = async () => {
    await fetchMenuData();
    setInstagramInput(currentUserData?.instagramUrl || "");
    setWhatsappInput(currentUserData?.whatsappPhone || "");
    setPhoneInput(currentUserData?.contactPhone || currentUserData?.phone || "");
    setIsEditingContactInfo(false);
    setContactVisible(true);
  };

  const openInstagram = async () => {
    try {
      const url = normalizeInstagramUrl(resolvedInstagramUrl) || DEFAULT_INSTAGRAM_URL;
      await Linking.openURL(url);
    } catch {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת אינסטגרם");
    }
  };

  const openWhatsApp = async () => {
    const message = encodeURIComponent("היי, אשמח לפרטים נוספים");
    const phoneForWhatsapp =
      normalizePhoneForWhatsapp(resolvedWhatsappPhone) || DEFAULT_WHATSAPP_PHONE;
    const url = `https://wa.me/${phoneForWhatsapp}?text=${message}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת וואטסאפ");
    }
  };

  const makePhoneCall = async () => {
    try {
      await Linking.openURL(`tel:${resolvedPhoneNumber}`);
    } catch {
      Alert.alert("שגיאה", "אירעה בעיה בפתיחת השיחה");
    }
  };

  const handleSaveContactInfo = async () => {
    const authUser = auth.currentUser;
    if (!authUser) {
      Alert.alert("שגיאה", "לא נמצא משתמש מחובר");
      return;
    }

    const resolvedUser = await resolveCurrentUserDoc();
    if (!resolvedUser) {
      Alert.alert("שגיאה", "לא נמצא מסמך משתמש");
      return;
    }

    const { docId: resolvedDocId, data: userData } = resolvedUser;

    const normalizedInstagram = normalizeInstagramUrl(instagramInput);
    const normalizedWhatsapp = normalizePhoneForWhatsapp(whatsappInput);
    const trimmedPhone = phoneInput.trim();
    const nowIso = new Date().toISOString();

    try {
      setSavingContactInfo(true);

      await updateDoc(doc(db, "users", resolvedDocId), {
        instagramUrl: normalizedInstagram,
        whatsappPhone: normalizedWhatsapp,
        contactPhone: trimmedPhone,
        updatedAt: nowIso,
        contactUpdatedAt: nowIso,
      });

      if (userData.role === "admin") {
        const adminUidCandidates = buildUidCandidates(
          authUser.uid,
          resolvedDocId,
          userData.uid,
          userData.authUid
        );

        const linkedClients = await fetchClientsForAnyLink(adminUidCandidates);

        if (linkedClients.length > 0) {
          const batch = writeBatch(db);

          linkedClients.forEach((clientItem) => {
            batch.update(doc(db, "users", clientItem.id), {
              instagramUrl: normalizedInstagram,
              whatsappPhone: normalizedWhatsapp,
              contactPhone: trimmedPhone,
              contactOwnerUid: resolvedDocId,
              contactUpdatedAt: nowIso,
              updatedAt: nowIso,
            });
          });

          await batch.commit();
        }
      }

      const nextUserData: CurrentUserData = {
        ...userData,
        instagramUrl: normalizedInstagram,
        whatsappPhone: normalizedWhatsapp,
        contactPhone: trimmedPhone,
        updatedAt: nowIso,
        contactUpdatedAt: nowIso,
      };

      setCurrentUserData(nextUserData);

      setResolvedContactData({
        instagramUrl: normalizedInstagram,
        whatsappPhone: normalizedWhatsapp,
        contactPhone: trimmedPhone,
        phone: nextUserData.phone,
        name: nextUserData.name,
        uid: resolvedDocId,
      });

      setIsEditingContactInfo(false);
      Alert.alert("הצלחה", "פרטי צור הקשר נשמרו בהצלחה");

      await fetchMenuData();
    } catch (error) {
      console.error("שגיאה בשמירת פרטי צור קשר:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור את פרטי צור הקשר");
    } finally {
      setSavingContactInfo(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    const confirmed = await confirmAction("התנתקות", "האם את בטוחה שברצונך להתנתק?");
    if (!confirmed) return;

    try {
      setLoggingOut(true);
      await auth.signOut();
      router.replace("/");
    } catch (error) {
      console.error("שגיאה בהתנתקות:", error);
      Platform.OS === "web"
        ? window.alert("אירעה בעיה בהתנתקות")
        : Alert.alert("שגיאה", "אירעה בעיה בהתנתקות");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteClient = async (targetUid: string) => {
    const confirmed = await confirmAction(
      "מחיקת לקוח",
      "האם את בטוחה שברצונך למחוק את הלקוח? הנתונים שלו יימחקו מהמערכת."
    );

    if (!confirmed) return;

    try {
      const matchedClient =
        clients.find((c) => getClientResolvedUid(c) === targetUid) || null;

      const possibleUserDocIds = Array.from(
        new Set([matchedClient?.id, matchedClient?.uid, matchedClient?.authUid].filter(Boolean))
      ) as string[];

      let deletedUserDoc = false;

      for (const docId of possibleUserDocIds) {
        try {
          await deleteDoc(doc(db, "users", docId));
          deletedUserDoc = true;
          break;
        } catch {}
      }

      const workoutsQuery = query(collection(db, "workouts"), where("uid", "==", targetUid));
      const workoutsSnap = await getDocs(workoutsQuery);

      const exercisesQuery = query(collection(db, "exercises"), where("uid", "==", targetUid));
      const exercisesSnap = await getDocs(exercisesQuery);

      await Promise.all([
        ...workoutsSnap.docs.map((d) => deleteDoc(doc(db, "workouts", d.id))),
        ...exercisesSnap.docs.map((d) => deleteDoc(doc(db, "exercises", d.id))),
      ]);

      setClients((prev) => prev.filter((c) => getClientResolvedUid(c) !== targetUid));

      Platform.OS === "web"
        ? window.alert(
            deletedUserDoc
              ? "הלקוח נמחק מהמערכת"
              : "נתוני האימונים נמחקו, אך מסמך המשתמש לא נמצא"
          )
        : Alert.alert(
            "הצלחה",
            deletedUserDoc
              ? "הלקוח נמחק מהמערכת"
              : "נתוני האימונים נמחקו, אך מסמך המשתמש לא נמצא"
          );
    } catch (error) {
      console.error("שגיאה במחיקת לקוח:", error);
      Platform.OS === "web"
        ? window.alert("לא ניתן למחוק את הלקוח")
        : Alert.alert("שגיאה", "לא ניתן למחוק את הלקוח");
    }
  };

  const currentApprovalLabel =
    currentUserData?.approvalStatus === "approved"
      ? "מאושר"
      : currentUserData?.approvalStatus === "blocked"
      ? "חסום"
      : "ממתין לאישור";

  const currentClientCardStats = getCardPurchaseStats(currentUserData);
  const cardsPurchased = currentClientCardStats.totalPurchased;
  const cardsUsed = currentClientCardStats.totalUsed;
  const cardsRemaining = currentClientCardStats.totalRemaining;
  const cardUsageDates = currentClientCardStats.allUsageDates;
  const cardPurchaseHistory = currentClientCardStats.purchases;
  const lastCardUsage = cardUsageDates[0] || null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppLayout>
          <View style={styles.screen}>
            <View style={styles.loadingScreen}>
              <ActivityIndicator size="large" color="#0F172A" />
              <Text style={styles.loaderText}>טוען נתונים...</Text>
            </View>
          </View>
        </AppLayout>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppLayout>
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: Math.max(height * 0.025, 18),
                paddingBottom: Math.max(height * 0.05, 32),
                paddingHorizontal: dynamic.horizontalPadding,
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.card,
                {
                  width: dynamic.cardWidth,
                  paddingHorizontal: dynamic.cardPaddingHorizontal,
                  paddingVertical: dynamic.cardPaddingVertical,
                },
              ]}
            >
              <View style={styles.header}>
                <Text
                  style={[
                    styles.title,
                    {
                      fontSize: dynamic.titleSize,
                      lineHeight: dynamic.titleSize * 1.45,
                    },
                  ]}
                >
                  תפריט
                </Text>

                <Text style={[styles.subtitle, { fontSize: dynamic.subtitleSize }]}>
                  {isOwner
                    ? "כאן אפשר ליצור קשר, להתנתק ולנהל גם לקוחות וגם מאמנים משניים"
                    : isAdmin
                    ? "כאן אפשר ליצור קשר, להתנתק, לנהל לקוחות ולבנות גם לעצמך תוכנית אימון"
                    : "כאן אפשר ליצור קשר, להתנתק ולראות את מצב הגישה שלך"}
                </Text>
              </View>

              <View style={styles.actionsContainer}>
                {!isManager && currentUserData && (
                  <View style={styles.accessWrapper}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.userSectionButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setAccessInfoOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <Text
                          style={[
                            styles.userSectionButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          פרטי גישה למערכת
                        </Text>

                        <Text style={styles.expandText}>
                          {accessInfoOpen ? "הסתרה" : "הצגה"}
                        </Text>
                      </View>
                    </Pressable>

                    {accessInfoOpen && (
                      <View style={styles.userSectionContent}>
                        <View style={styles.accessCard}>
                          <View style={styles.accessRow}>
                            <Text style={styles.accessLabel}>סטטוס</Text>
                            <Text style={styles.accessValue}>{currentApprovalLabel}</Text>
                          </View>

                          <View style={styles.accessRow}>
                            <Text style={styles.accessLabel}>תחילת גישה</Text>
                            <Text style={styles.accessValue}>
                              {formatDateTimeIL(currentUserData.accessStartAt)}
                            </Text>
                          </View>

                          <View style={styles.accessRow}>
                            <Text style={styles.accessLabel}>סיום גישה</Text>
                            <Text style={styles.accessValue}>
                              {formatDateTimeIL(currentUserData.accessEndAt)}
                            </Text>
                          </View>

                          <View style={[styles.accessRow, styles.accessRowLast]}>
                            <Text style={styles.accessLabel}>זמן נותר</Text>
                            <Text style={styles.accessValue}>
                              {getRemainingTimeLabel(currentUserData.accessEndAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    <Pressable
                      style={({ pressed }) => [
                        styles.userSectionButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setCardHistoryOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <Text
                          style={[
                            styles.userSectionButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          היסטוריית כרטיסיות
                        </Text>

                        <Text style={styles.expandText}>
                          {cardHistoryOpen ? "הסתרה" : "הצגה"}
                        </Text>
                      </View>
                    </Pressable>

                    {cardHistoryOpen && (
                      <View style={styles.userSectionContent}>
                        <View style={styles.clientCardsInfoCard}>
                          <View style={styles.clientCardsHeader}>
                            <Text style={styles.clientCardsInfoTitle}>היסטוריית כרטיסיות</Text>
                            <Text style={styles.clientCardsInfoSubtitle}>
                              כאן אפשר לראות את מצב הכרטיסייה והמימושים שבוצעו
                            </Text>
                          </View>

                          <View style={styles.clientCardsTopStatsRow}>
                            <View style={styles.clientCardsMiniStatBox}>
                              <Text style={styles.clientCardsMiniValue}>{cardsPurchased}</Text>
                              <Text style={styles.clientCardsMiniLabel}>נרכשו</Text>
                            </View>

                            <View style={styles.clientCardsMiniStatBox}>
                              <Text style={styles.clientCardsMiniValue}>{cardsUsed}</Text>
                              <Text style={styles.clientCardsMiniLabel}>מומשו</Text>
                            </View>

                            <View style={styles.clientCardsMiniStatBox}>
                              <Text style={styles.clientCardsMiniValue}>{cardsRemaining}</Text>
                              <Text style={styles.clientCardsMiniLabel}>נותרו</Text>
                            </View>
                          </View>

                          <View style={styles.clientCardsHighlightBox}>
                            <View style={styles.clientCardsHighlightTextWrap}>
                              <Text style={styles.clientCardsHighlightLabel}>מימוש אחרון</Text>
                              <Text style={styles.clientCardsHighlightValue}>
                                {lastCardUsage
                                  ? formatDateTimeIL(lastCardUsage)
                                  : "עדיין לא בוצע מימוש"}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.cardUsageHistoryBox}>
                            <View style={styles.cardUsageHistoryHeader}>
                              <Text style={styles.cardUsageHistoryTitle}>רכישות ומימושים לפי חידוש</Text>
                              <Text style={styles.cardUsageHistoryCount}>
                                {cardPurchaseHistory.length} רכישות
                              </Text>
                            </View>

                            <CardPurchaseHistoryView purchases={cardPurchaseHistory} />
                          </View>
                        </View>
                      </View>
                    )}

                    <Pressable
                      style={({ pressed }) => [
                        styles.userSectionButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setClientTrainingProgramOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <Text
                          style={[
                            styles.userSectionButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          תוכנית אימון
                        </Text>

                        <Text style={styles.expandText}>
                          {clientTrainingProgramOpen ? "הסתרה" : "הצגה"}
                        </Text>
                      </View>
                    </Pressable>

                    {clientTrainingProgramOpen && (
                      <View style={styles.userSectionContent}>
                        <ClientTrainingProgramViewer />
                      </View>
                    )}

                    <Pressable
                      style={({ pressed }) => [
                        styles.userSectionButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setClientExerciseLibraryOpen((prev) => !prev)}
                    >
                      <View style={styles.buttonRow}>
                        <Text
                          style={[
                            styles.userSectionButtonText,
                            { fontSize: dynamic.textSize },
                          ]}
                        >
                          מאגר תרגילים
                        </Text>

                        <Text style={styles.expandText}>
                          {clientExerciseLibraryOpen ? "הסתרה" : "הצגה"}
                        </Text>
                      </View>
                    </Pressable>

                    {clientExerciseLibraryOpen && (
                      <View style={styles.userSectionContent}>
                        <ClientExerciseLibrary />
                      </View>
                    )}
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { minHeight: dynamic.buttonHeight },
                    pressed && styles.pressed,
                  ]}
                  onPress={openContactModal}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { fontSize: dynamic.textSize },
                    ]}
                  >
                    צור קשר
                  </Text>
                </Pressable>

                {isManager && (
                  <View style={styles.adminWrapper}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.adminMainButton,
                        { minHeight: dynamic.buttonHeight },
                        pressed && styles.pressedLight,
                      ]}
                      onPress={() => setAdminActionsOpen((prev) => !prev)}
                    >
                      <View style={styles.adminMainButtonInner}>
                        <View style={styles.mainButtonContentCentered}>
                          <View style={styles.iconWrap}>
                            <AdminIcon size={dynamic.iconSize} color="#1E293B" />
                          </View>

                          <Text
                            style={[styles.adminMainButtonText, { fontSize: dynamic.textSize }]}
                            numberOfLines={1}
                          >
                            {isOwner ? "פעולות לבעלת המערכת" : "פעולות למאמן"}
                          </Text>
                        </View>

                        <Text style={styles.mainExpandTextAbsolute}>
                          {adminActionsOpen ? "סגירה" : "פתיחה"}
                        </Text>
                      </View>
                    </Pressable>

                    {adminActionsOpen && (
                      <View style={styles.adminDropdown}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.categoryButton,
                            { minHeight: dynamic.buttonHeight - 2 },
                            pressed && styles.pressedLight,
                          ]}
                          onPress={() => setManagerExerciseLibraryOpen((prev) => !prev)}
                        >
                          <View style={styles.buttonRow}>
                            <View style={styles.categoryButtonContent}>
                              <View style={styles.iconWrap}>
                                <WorkoutTrackingIcon size={20} color="#0F172A" />
                              </View>

                              <Text style={styles.categoryButtonText} numberOfLines={1}>
                                מאגר אימונים שלי
                              </Text>
                            </View>

                            <Text style={styles.categoryExpandText}>
                              {managerExerciseLibraryOpen ? "סגירה" : "פתיחה"}
                            </Text>
                          </View>
                        </Pressable>

                        {managerExerciseLibraryOpen && (
                          <View style={styles.categoryContent}>
                            <ClientExerciseLibrary />
                          </View>
                        )}

                        {isOwner && (
                          <>
                            <Pressable
                              style={({ pressed }) => [
                                styles.categoryButton,
                                { minHeight: dynamic.buttonHeight - 2 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setSecondaryAdminsOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <View style={styles.categoryButtonContent}>
                                  <View style={styles.iconWrap}>
                                    <GroupsIcon size={20} color="#0F172A" />
                                  </View>

                                  <Text style={styles.categoryButtonText} numberOfLines={1}>
                                    ניהול מאמנים משניים
                                  </Text>
                                </View>

                                <Text style={styles.categoryExpandText}>
                                  {secondaryAdminsOpen ? "סגירה" : "פתיחה"}
                                </Text>
                              </View>
                            </Pressable>

                            {secondaryAdminsOpen && (
                              <View style={styles.categoryContent}>
                                <View style={styles.secondaryAdminStatsContainer}>
                                  <View style={styles.secondaryAdminStatsHeader}>
                                    <Text style={styles.secondaryAdminStatsTitle}>
                                      כמות מתאמנים לכל מאמן משני
                                    </Text>
                                    <Text style={styles.secondaryAdminStatsSubtitle}>
                                      הנתון מחושב לפי הלקוחות שמקושרים לכל מאמן משני
                                    </Text>
                                  </View>

                                  {secondaryAdminClientCounts.length === 0 ? (
                                    <View style={styles.emptyClientsBox}>
                                      <Text style={styles.emptyClientsText}>
                                        עדיין אין מאמנים משניים להצגה
                                      </Text>
                                    </View>
                                  ) : (
                                    <View style={styles.secondaryAdminStatsList}>
                                      {secondaryAdminClientCounts.map((item) => (
                                        <View
                                          key={item.adminId}
                                          style={styles.secondaryAdminStatCard}
                                        >
                                          <View style={styles.secondaryAdminCountBadge}>
                                            <Text style={styles.secondaryAdminCountBadgeText}>
                                              {item.clientCount}
                                            </Text>
                                          </View>

                                          <View style={styles.secondaryAdminStatContent}>
                                            <Text style={styles.secondaryAdminStatName}>
                                              {item.adminName}
                                            </Text>
                                            <Text style={styles.secondaryAdminStatEmail}>
                                              {item.adminEmail}
                                            </Text>
                                            <Text style={styles.secondaryAdminStatMeta}>
                                              {item.clientCount === 1
                                                ? "מתאמן אחד"
                                                : `${item.clientCount} מתאמנים`}
                                            </Text>
                                          </View>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>

                                <SecondaryAdminsManager onAfterUpdate={fetchMenuData} />
                              </View>
                            )}
                          </>
                        )}

                        <Pressable
                          style={({ pressed }) => [
                            styles.categoryButton,
                            { minHeight: dynamic.buttonHeight - 2 },
                            pressed && styles.pressedLight,
                          ]}
                          onPress={() => setClientsSectionOpen((prev) => !prev)}
                        >
                          <View style={styles.buttonRow}>
                            <View style={styles.categoryButtonContent}>
                              <View style={styles.iconWrap}>
                                <GroupsIcon size={20} color="#0F172A" />
                              </View>

                              <Text style={styles.categoryButtonText} numberOfLines={1}>
                                ניהול לקוחות
                              </Text>
                            </View>

                            <Text style={styles.categoryExpandText}>
                              {clientsSectionOpen ? "סגירה" : "פתיחה"}
                            </Text>
                          </View>
                        </Pressable>

                        {clientsSectionOpen && (
                          <View style={styles.categoryContent}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setCreateClientOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>הוספת לקוח</Text>
                                <Text style={styles.subActionExpandText}>
                                  {createClientOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {createClientOpen && (
                              <View style={styles.subActionContent}>
                                <CoachClientCreator onAfterCreate={fetchMenuData} />
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setDeleteClientsOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>מחיקת לקוח</Text>
                                <Text style={styles.subActionExpandText}>
                                  {deleteClientsOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {deleteClientsOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  clients.map((client) => {
                                    const targetUid = getClientResolvedUid(client);

                                    return (
                                      <View key={`delete-${client.id}`} style={styles.clientRow}>
                                        <View style={styles.clientActions}>
                                          <Pressable
                                            style={({ pressed }) => [
                                              styles.deleteClientButton,
                                              pressed && styles.deletePressed,
                                            ]}
                                            onPress={() => handleDeleteClient(targetUid)}
                                            hitSlop={10}
                                          >
                                            <Text style={styles.deleteClientButtonText}>מחקי</Text>
                                          </Pressable>
                                        </View>

                                        <View style={styles.clientInfo}>
                                          <Text style={styles.clientName}>
                                            {client.name || "ללא שם"}
                                          </Text>

                                          <Text style={styles.clientEmail}>
                                            {client.email || "ללא אימייל"}
                                          </Text>
                                        </View>
                                      </View>
                                    );
                                  })
                                )}
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setAccessManagementOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>הגדרת תקופת גישה</Text>
                                <Text style={styles.subActionExpandText}>
                                  {accessManagementOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {accessManagementOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientAccessManager onAfterUpdate={fetchMenuData} />
                                )}
                              </View>
                            )}
                          </View>
                        )}

                        <Pressable
                          style={({ pressed }) => [
                            styles.categoryButton,
                            { minHeight: dynamic.buttonHeight - 2 },
                            pressed && styles.pressedLight,
                          ]}
                          onPress={() => setTrainingManagementOpen((prev) => !prev)}
                        >
                          <View style={styles.buttonRow}>
                            <View style={styles.categoryButtonContent}>
                              <View style={styles.iconWrap}>
                                <WorkoutTrackingIcon size={20} color="#0F172A" />
                              </View>

                              <Text style={styles.categoryButtonText} numberOfLines={1}>
                                ניהול אימונים וכרטיסיות
                              </Text>
                            </View>

                            <Text style={styles.categoryExpandText}>
                              {trainingManagementOpen ? "סגירה" : "פתיחה"}
                            </Text>
                          </View>
                        </Pressable>

                        {trainingManagementOpen && (
                          <View style={styles.categoryContent}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setTrainingProgramManagerOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>תוכנית אימון</Text>
                                <Text style={styles.subActionExpandText}>
                                  {trainingProgramManagerOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {trainingProgramManagerOpen && (
                              <View style={styles.subActionContent}>
                                {trainingProgramTargets.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין מתאמנים להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientTrainingProgramManager
                                    clients={trainingProgramTargets}
                                    currentUserData={currentUserData}
                                    onAfterSave={fetchMenuData}
                                  />
                                )}
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setManualWorkoutEntryOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>
                                  הזנת אימון ידני ללקוח
                                </Text>
                                <Text style={styles.subActionExpandText}>
                                  {manualWorkoutEntryOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {manualWorkoutEntryOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ManualWorkoutEntryManager
                                    clients={clients}
                                    currentUserData={currentUserData}
                                    onAfterSave={fetchMenuData}
                                  />
                                )}
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setClientWorkoutTrackingOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>
                                  מעקב אחרי אימון לקוח
                                </Text>
                                <Text style={styles.subActionExpandText}>
                                  {clientWorkoutTrackingOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {clientWorkoutTrackingOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientProgressTracker clients={clients} />
                                )}
                              </View>
                            )}

                            <Pressable
                              style={({ pressed }) => [
                                styles.subActionButton,
                                { minHeight: dynamic.buttonHeight - 8 },
                                pressed && styles.pressedLight,
                              ]}
                              onPress={() => setClientCardManagerOpen((prev) => !prev)}
                            >
                              <View style={styles.buttonRow}>
                                <Text style={styles.subActionButtonText}>מימוש כרטיסייה</Text>
                                <Text style={styles.subActionExpandText}>
                                  {clientCardManagerOpen ? "הסתרה" : "הצגה"}
                                </Text>
                              </View>
                            </Pressable>

                            {clientCardManagerOpen && (
                              <View style={styles.subActionContent}>
                                {clients.length === 0 ? (
                                  <View style={styles.emptyClientsBox}>
                                    <Text style={styles.emptyClientsText}>אין לקוחות להצגה</Text>
                                  </View>
                                ) : (
                                  <ClientCardRenewalManager
                                    clients={clients}
                                    currentUserData={currentUserData}
                                    onAfterUpdate={fetchMenuData}
                                  />
                                )}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.logoutButton,
                    { minHeight: dynamic.buttonHeight },
                    pressed && styles.logoutPressed,
                    loggingOut && styles.disabledButton,
                  ]}
                  onPress={handleLogout}
                  disabled={loggingOut}
                  hitSlop={6}
                >
                  {loggingOut ? (
                    <ActivityIndicator color="#DC2626" />
                  ) : (
                    <Text
                      style={[
                        styles.logoutButtonText,
                        { fontSize: dynamic.textSize },
                      ]}
                    >
                      התנתקות
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <Modal
            visible={contactVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setContactVisible(false);
              setIsEditingContactInfo(false);
            }}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalCard,
                  {
                    width: dynamic.modalWidth,
                    maxHeight: height * 0.82,
                  },
                ]}
              >
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <View style={styles.modalHeaderRow}>
                    {isAdmin ? (
                      <Pressable
                        onPress={() => setIsEditingContactInfo(true)}
                        style={({ pressed }) => [
                          styles.editToggleButton,
                          pressed && styles.pressedLight,
                          isEditingContactInfo && styles.hiddenButton,
                        ]}
                        disabled={isEditingContactInfo}
                      >
                        <Text style={styles.editToggleButtonText}>עריכה</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.editToggleSpacer} />
                    )}

                    <View style={styles.modalHeaderCenter}>
                      <Text style={styles.modalTitle}>
                        {isEditingContactInfo ? "עריכת צור קשר" : "צור קשר"}
                      </Text>
                      <Text style={styles.modalSubtitle}>
                        {isEditingContactInfo
                          ? "עדכני את הפרטים ולחצי על שמור שינויים"
                          : "בחרי איך נוח לך ליצור קשר"}
                      </Text>
                    </View>

                    <View style={styles.editToggleSpacer} />
                  </View>

                  {isEditingContactInfo && isAdmin ? (
                    <View style={styles.contactEditorBox}>
                      <Text style={styles.contactEditorTitle}>עדכון פרטי צור קשר</Text>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>קישור לאינסטגרם</Text>
                        <TextInput
                          value={instagramInput}
                          onChangeText={setInstagramInput}
                          placeholder="לדוגמה: hadar_taizi או קישור מלא"
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                          autoCapitalize="none"
                          textAlign="right"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>מספר וואטסאפ</Text>
                        <TextInput
                          value={whatsappInput}
                          onChangeText={setWhatsappInput}
                          placeholder="0501234567"
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                          keyboardType="phone-pad"
                          textAlign="right"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>מספר טלפון</Text>
                        <TextInput
                          value={phoneInput}
                          onChangeText={setPhoneInput}
                          placeholder="0501234567"
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                          keyboardType="phone-pad"
                          textAlign="right"
                        />
                      </View>

                      <Pressable
                        onPress={handleSaveContactInfo}
                        disabled={savingContactInfo}
                        style={({ pressed }) => [
                          styles.saveContactButton,
                          pressed && styles.pressed,
                          savingContactInfo && styles.disabledButton,
                        ]}
                      >
                        {savingContactInfo ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.saveContactButtonText}>שמור שינויים</Text>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        style={({ pressed }) => [
                          styles.contactButton,
                          { minHeight: dynamic.buttonHeight - 2 },
                          pressed && styles.pressedLight,
                        ]}
                        onPress={openInstagram}
                      >
                        <Text style={styles.contactButtonText}>אינסטגרם</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.contactButton,
                          { minHeight: dynamic.buttonHeight - 2 },
                          pressed && styles.pressedLight,
                        ]}
                        onPress={openWhatsApp}
                      >
                        <Text style={styles.contactButtonText}>וואטסאפ</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.contactButton,
                          { minHeight: dynamic.buttonHeight - 2 },
                          pressed && styles.pressedLight,
                        ]}
                        onPress={makePhoneCall}
                      >
                        <Text style={styles.contactButtonText}>שיחת טלפון</Text>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    onPress={() => {
                      setContactVisible(false);
                      setIsEditingContactInfo(false);
                    }}
                    style={({ pressed }) => [
                      styles.closeButton,
                      { minHeight: dynamic.buttonHeight - 4 },
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.closeButtonText}>סגור</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      </AppLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  screen: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  header: {
    alignItems: "center",
    marginBottom: 26,
  },
  title: {
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
  },
  subtitle: {
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  loaderText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 15,
    textAlign: "center",
  },
  actionsContainer: {
    gap: 14,
    width: "100%",
  },
  buttonRow: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  mainButtonContentCentered: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adminMainButtonInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  categoryButtonContent: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
  },
  accessWrapper: {
    width: "100%",
    gap: 10,
  },
  userSectionButton: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D7DFE9",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
    justifyContent: "center",
  },
  userSectionButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },
  userSectionContent: {
    marginRight: 8,
    paddingRight: 12,
    borderRightWidth: 3,
    borderRightColor: "#DCE6F4",
  },
  expandText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
  },
  adminWrapper: {
    width: "100%",
    gap: 12,
  },
  adminMainButton: {
    borderRadius: 20,
    backgroundColor: "#E8EEFF",
    borderWidth: 1.5,
    borderColor: "#B8C8FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    width: "100%",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  adminMainButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    textAlign: "center",
  },
  mainExpandTextAbsolute: {
    position: "absolute",
    left: 0,
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "left",
  },
  adminDropdown: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    width: "100%",
    gap: 12,
  },
  categoryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: "100%",
    justifyContent: "center",
  },
  categoryButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "right",
  },
  categoryExpandText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "left",
  },
  categoryContent: {
    gap: 10,
    marginTop: 2,
    marginRight: 10,
    paddingRight: 14,
    borderRightWidth: 4,
    borderRightColor: "#C7D7F8",
  },
  subActionButton: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    paddingVertical: 13,
    paddingHorizontal: 15,
    width: "100%",
    justifyContent: "center",
  },
  subActionButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "right",
    flex: 1,
  },
  subActionExpandText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
  },
  subActionContent: {
    marginTop: 6,
    marginRight: 8,
    paddingRight: 12,
    gap: 10,
    borderRightWidth: 2,
    borderRightColor: "#E2E8F0",
  },
  secondaryAdminStatsContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE7F5",
    padding: 14,
    gap: 12,
  },
  secondaryAdminStatsHeader: {
    alignItems: "flex-end",
    gap: 4,
  },
  secondaryAdminStatsTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  secondaryAdminStatsSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  secondaryAdminStatsList: {
    gap: 10,
  },
  secondaryAdminStatCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  secondaryAdminCountBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E0E7FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryAdminCountBadgeText: {
    color: "#3730A3",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryAdminStatContent: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },
  secondaryAdminStatName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  secondaryAdminStatEmail: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "right",
  },
  secondaryAdminStatMeta: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 2,
  },
  accessCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  accessRow: {
    width: "100%",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 12,
  },
  accessRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  accessLabel: {
    width: 92,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "700",
    textAlign: "right",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  accessValue: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  clientCardsInfoCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  clientCardsHeader: {
    alignItems: "flex-end",
    gap: 4,
  },
  clientCardsInfoTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  clientCardsInfoSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  clientCardsTopStatsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 10,
  },
  clientCardsMiniStatBox: {
    flex: 1,
    minHeight: 96,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  clientCardsMiniValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  clientCardsMiniLabel: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  clientCardsHighlightBox: {
    width: "100%",
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  clientCardsHighlightTextWrap: {
    alignItems: "flex-end",
    gap: 6,
  },
  clientCardsHighlightLabel: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  clientCardsHighlightValue: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 22,
  },
  cardUsageHistoryBox: {
    marginTop: 2,
    gap: 12,
  },
  cardUsageHistoryHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardUsageHistoryTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  cardUsageHistoryCount: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "left",
  },
  cardUsageList: {
    gap: 10,
  },
  cardUsageRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  cardUsageOrderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E0E7FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  cardUsageOrderBadgeText: {
    color: "#3730A3",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  cardUsageContent: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },
  cardUsageMainText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  cardUsageSubText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },
  emptyCardHistoryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCardHistoryText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyClientsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  emptyClientsText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  clientRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  clientInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  clientName: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "right",
  },
  clientEmail: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "right",
    marginTop: 4,
  },
  clientActions: {
    justifyContent: "center",
    alignItems: "center",
  },
  deleteClientButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteClientButtonText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  logoutButton: {
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },
  logoutButtonText: {
    color: "#DC2626",
    fontWeight: "800",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignSelf: "center",
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalHeaderRow: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 10,
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    textAlign: "center",
    fontWeight: "800",
    fontSize: 22,
    color: "#0F172A",
    marginBottom: 8,
  },
  modalSubtitle: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },
  editToggleSpacer: {
    width: 66,
  },
  editToggleButton: {
    minWidth: 66,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  editToggleButtonText: {
    color: "#1D4ED8",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
  },
  hiddenButton: {
    opacity: 0,
  },
  contactEditorBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  contactEditorTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
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
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  saveContactButton: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: "#059669",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  saveContactButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  contactButton: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 10,
  },
  contactButtonText: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    width: "100%",
  },
  closeButton: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    width: "100%",
  },
  closeButtonText: {
    color: "#1E293B",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },

  manualWorkoutCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE7F5",
    padding: 14,
    gap: 14,
  },
  manualWorkoutHeader: {
    alignItems: "flex-end",
    gap: 4,
  },
  manualWorkoutTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  manualWorkoutSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  manualWorkoutSectionLabel: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  manualWorkoutClientsScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  manualWorkoutClientPill: {
    minWidth: 110,
    maxWidth: 180,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  manualWorkoutClientPillActive: {
    backgroundColor: "#E0E7FF",
    borderColor: "#A5B4FC",
  },
  manualWorkoutClientPillText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  manualWorkoutClientPillTextActive: {
    color: "#3730A3",
  },
  manualWorkoutFormBox: {
    gap: 12,
  },
  manualWorkoutExercisesHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  addExerciseRowButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  addExerciseRowButtonBelowSave: {
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addExerciseRowButtonText: {
    color: "#4338CA",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  manualExerciseList: {
    gap: 12,
  },
  manualExerciseCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  manualExerciseCardTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  manualExerciseCardTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  removeExerciseRowButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  removeExerciseRowButtonText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  manualExerciseStatsRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  manualExerciseStatCol: {
    flex: 1,
    gap: 6,
  },
  saveManualWorkoutButton: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  saveManualWorkoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  clearManualWorkoutButton: {
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  clearManualWorkoutButtonText: {
    color: "#334155",
    fontWeight: "800",
    textAlign: "center",
  },
  datePickerButton: {
    width: "100%",
    minHeight: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
  },
  datePickerButtonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  datePickerButtonHint: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dateModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  dateModalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  iosDatePicker: {
    width: "100%",
    height: 180,
  },
  dateModalButtonsRow: {
    width: "100%",
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 12,
  },
  dateModalPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dateModalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  dateModalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dateModalSecondaryButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  manualSetsHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  manualSetsList: {
    gap: 10,
  },
  manualSetCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE7F5",
    padding: 10,
    gap: 10,
  },
  manualSetCardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  manualSetTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  addSetButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addSetButtonText: {
    color: "#4338CA",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  removeSetButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  removeSetButtonText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },


  cardRenewalManagerCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE7F5",
    padding: 14,
    gap: 14,
  },
  cardRenewalSelectedBox: {
    gap: 14,
  },
  cardRenewalFormBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  addCardPurchaseButton: {
    borderRadius: 16,
    backgroundColor: "#059669",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addCardPurchaseButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  redeemCardButton: {
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  redeemCardButtonText: {
    color: "#1D4ED8",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
  },
  cardPurchaseGroupsList: {
    gap: 12,
  },
  cardPurchaseGroupCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE7F5",
    padding: 12,
    gap: 12,
  },
  cardPurchaseGroupHeaderPressable: {
    width: "100%",
    borderRadius: 16,
    gap: 8,
  },
  cardPurchaseGroupHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardPurchaseGroupTitleWrap: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },
  cardPurchaseGroupTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  cardPurchaseGroupDate: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  cardPurchaseGroupBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPurchaseGroupBadgeText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  cardPurchaseMiniStatsRow: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  cardPurchaseMiniStatBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cardPurchaseMiniStatValue: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  cardPurchaseMiniStatLabel: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  cardPurchaseUsageSection: {
    gap: 10,
  },

  cardUsageActionsRow: {
    marginTop: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  editUsageButton: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  editUsageButtonText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  deleteUsageButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  deleteUsageButtonText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  editUsageModalCard: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  editUsageModalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  editUsageModalSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  editUsagePickerRow: {
    width: "100%",
    flexDirection: "row-reverse",
    gap: 6,
    flexWrap: "nowrap",
    alignItems: "flex-start",
    overflow: "hidden",
  },
  editUsagePickerCol: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: "50%",
    gap: 6,
    overflow: "hidden",
  },
  editUsagePickerButton: {
    width: "100%",
    minHeight: 46,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    overflow: "hidden",
  },
  editUsagePickerButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "ltr",
  },
  editUsageModalButtonsRow: {
    width: "100%",
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 4,
  },

  inlineDateTimePicker: {
    width: "100%",
    minHeight: 120,
    alignSelf: "stretch",
  },
  editUsagePickerRowStacked: {
    flexDirection: "row-reverse",
  },
  responsiveWebInputWrap: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  clientSearchBox: {
    width: "100%",
    gap: 10,
  },
  clientSearchInput: {
    width: "100%",
    minHeight: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    writingDirection: "rtl",
  },
  clientSearchResultsList: {
    width: "100%",
    gap: 8,
  },
  clientSearchResultItem: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "flex-end",
    gap: 3,
  },
  clientSearchResultItemActive: {
    backgroundColor: "#E0E7FF",
    borderColor: "#A5B4FC",
  },
  clientSearchResultName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  clientSearchResultMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  selectedClientSummaryBox: {
    width: "100%",
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "flex-end",
    gap: 4,
  },
  selectedClientSummaryTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  selectedClientSummaryMeta: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },

  pressed: {
    opacity: 0.85,
  },
  pressedLight: {
    opacity: 0.75,
  },
  logoutPressed: {
    opacity: 0.8,
  },
  deletePressed: {
    opacity: 0.7,
  },
  disabledButton: {
    opacity: 0.6,
  },
});