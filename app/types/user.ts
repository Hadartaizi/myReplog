export type UserRole = "owner" | "admin" | "client";

export type ApprovalStatus = "pending" | "approved" | "blocked";

export type UserDoc = {
  name?: string;
  email?: string;
  phone?: string;

  role?: UserRole;
  approvalStatus?: ApprovalStatus;

  accessStartAt?: string | null;
  accessEndAt?: string | null;

  createdByOwnerUid?: string | null;
  isSecondaryAdmin?: boolean;

  createdByUid?: string | null;

  hasLoginAccount?: boolean;
  authUid?: string | null;

  cardsPurchased?: number;
  cardsUsed?: number;
  cardUsageDates?: string[];

  showInTracker?: boolean;

  instagramUrl?: string;
  whatsappPhone?: string;
  contactPhone?: string;

  createdAt?: string;
  updatedAt?: string;
};