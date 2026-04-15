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

export async function completeClientSignupAfterAuth(params: {
  authUid: string;
  email: string;
  fallbackName?: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();

  const inviteQuery = query(
    collection(db, "clientInvites"),
    where("email", "==", normalizedEmail),
    where("inviteStatus", "==", "pending")
  );

  const inviteSnap = await getDocs(inviteQuery);

  if (inviteSnap.empty) {
    // אין הזמנה פעילה - ניצור משתמש רגיל, עדיין כלקוח
    const userDoc: UserDoc = {
      name: params.fallbackName?.trim() || "",
      email: normalizedEmail,
      role: "client",
      approvalStatus: "pending",
      accessStartAt: null,
      accessEndAt: null,
      createdByUid: null,
      hasLoginAccount: true,
      authUid: params.authUid,
      cardsPurchased: 0,
      cardsUsed: 0,
      cardUsageDates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "users", params.authUid), userDoc, { merge: true });
    return { matchedInvite: false };
  }

  const inviteDocSnap = inviteSnap.docs[0];
  const invite = inviteDocSnap.data() as ClientInviteDoc;

  const userDoc: UserDoc = {
    name: invite.name || params.fallbackName?.trim() || "",
    email: normalizedEmail,
    phone: invite.phone || "",
    role: "client",
    approvalStatus: invite.approvalStatus || "approved",
    accessStartAt: invite.accessStartAt || null,
    accessEndAt: invite.accessEndAt || null,
    createdByUid: invite.createdByUid || null,
    hasLoginAccount: true,
    authUid: params.authUid,
    cardsPurchased: invite.cardsPurchased || 0,
    cardsUsed: invite.cardsUsed || 0,
    cardUsageDates: invite.cardUsageDates || [],
    createdAt: invite.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, "users", params.authUid), userDoc, { merge: true });

  await updateDoc(doc(db, "clientInvites", inviteDocSnap.id), {
    inviteStatus: "completed",
    authUid: params.authUid,
    hasLoginAccount: true,
    updatedAt: new Date().toISOString(),
  });

  return { matchedInvite: true, inviteCreatorUid: invite.createdByUid || null };
}