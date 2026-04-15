export type ClientInviteStatus = "pending" | "completed" | "cancelled";

export type ClientInviteDoc = {
  name: string;
  email: string;
  phone?: string;

  role: "client";
  approvalStatus: "approved" | "pending" | "blocked";

  accessStartAt: string | null;
  accessEndAt: string | null;

  createdByUid: string; // ה-uid של המאמן או בעלת המערכת
  inviteStatus: ClientInviteStatus;

  hasLoginAccount: false;
  authUid: null;

  cardsPurchased: number;
  cardsUsed: number;
  cardUsageDates: string[];

  createdAt: string;
  updatedAt: string;
};