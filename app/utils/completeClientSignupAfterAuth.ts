import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../database/firebase";
import type { ClientInviteDoc } from "../types/clientInvite";
import type { UserDoc } from "../types/user";

const normalizeEmail = (value?: string | null) =>
  String(value || "").trim().toLowerCase();

export async function completeClientSignupAfterAuth(params: {
  authUid: string;
  email: string;
  fallbackName?: string;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  const nowIso = new Date().toISOString();

  if (!normalizedEmail) {
    throw new Error("Missing email for client signup");
  }

  const inviteQuery = query(
    collection(db, "clientInvites"),
    where("email", "==", normalizedEmail),
    where("inviteStatus", "==", "pending")
  );

  const inviteSnap = await getDocs(inviteQuery);

  if (inviteSnap.empty) {
    const userDoc: UserDoc = {
      name: params.fallbackName?.trim() || "",
      email: normalizedEmail,
      role: "client",
      approvalStatus: "pending",
      accessStartAt: null,
      accessEndAt: null,
      createdByUid: null,
      createdByOwnerUid: null,
      contactOwnerUid: null,
      hasLoginAccount: true,
      authUid: params.authUid,
      uid: params.authUid,
      cardsPurchased: 0,
      cardsUsed: 0,
      cardUsageDates: [],
      cardPurchases: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(doc(db, "users", params.authUid), userDoc, { merge: true });

    return { matchedInvite: false };
  }

  const inviteDocSnap = inviteSnap.docs[0];
  const invite = inviteDocSnap.data() as ClientInviteDoc;

  const coachUid = String(invite.createdByUid || "").trim();
  const ownerUid = String(
    (invite as any).createdByOwnerUid || invite.createdByUid || ""
  ).trim();

  const userDoc: UserDoc = {
    // השם רק לתצוגה!
    name: params.fallbackName?.trim() || invite.name || "",
    email: normalizedEmail,
    phone: invite.phone || "",

    role: "client",
    approvalStatus: invite.approvalStatus || "approved",
    accessStartAt: invite.accessStartAt || null,
    accessEndAt: invite.accessEndAt || null,

    // 🔥 השיוך לפי מייל בלבד (דרך ההזמנה)
    createdByUid: coachUid || null,
    createdByOwnerUid: ownerUid || null,
    contactOwnerUid: coachUid || null,

    hasLoginAccount: true,
    authUid: params.authUid,
    uid: params.authUid,

    cardsPurchased: invite.cardsPurchased || 0,
    cardsUsed: invite.cardsUsed || 0,
    cardUsageDates: invite.cardUsageDates || [],
    cardPurchases: (invite as any).cardPurchases || [],

    createdAt: invite.createdAt || nowIso,
    updatedAt: nowIso,
  };

  await setDoc(doc(db, "users", params.authUid), userDoc, { merge: true });

  await updateDoc(doc(db, "clientInvites", inviteDocSnap.id), {
    inviteStatus: "completed",
    authUid: params.authUid,
    hasLoginAccount: true,
    completedAt: nowIso,
    updatedAt: nowIso,
  });

  return {
    matchedInvite: true,
    inviteCreatorUid: coachUid || null,
  };
}