import type { UserRole, UserDoc } from "../../types/user";
export type AccessStatus = 'pending' | 'approved' | 'blocked';

type FirestoreLikeTimestamp = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
};

export type UserAccessData = {
  approvalStatus?: AccessStatus;
  accessStartAt?: string | Date | FirestoreLikeTimestamp | null;
  accessEndAt?: string | Date | FirestoreLikeTimestamp | null;
  role?: 'admin' | 'client';
};

const ACCESS_GRACE_MS = 10 * 1000; // 10 שניות מרווח ביטחון

export const parseAccessDate = (
  value?: string | Date | FirestoreLikeTimestamp | null
) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.toDate === 'function'
  ) {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.seconds === 'number'
  ) {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

export const formatDateTimeIL = (
  value?: string | Date | FirestoreLikeTimestamp | null
) => {
  const date = parseAccessDate(value);
  if (!date) return 'ללא הגבלה';

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const getAccessState = (userData?: UserAccessData | null) => {
  if (!userData) {
    return {
      allowed: false,
      reason: 'missing_user_doc' as const,
    };
  }

  if (userData.role === 'admin') {
    return {
      allowed: true,
      reason: 'admin' as const,
    };
  }

  if (userData.approvalStatus === 'blocked') {
    return {
      allowed: false,
      reason: 'blocked' as const,
    };
  }

  if (userData.approvalStatus === 'pending') {
    return {
      allowed: false,
      reason: 'pending_approval' as const,
    };
  }

  if (userData.approvalStatus !== 'approved') {
    return {
      allowed: false,
      reason: 'not_approved' as const,
    };
  }

  const startDate = parseAccessDate(userData.accessStartAt);
  if (userData.accessStartAt && !startDate) {
    return {
      allowed: false,
      reason: 'invalid_access_start' as const,
    };
  }

  const now = Date.now();

  if (startDate && now + ACCESS_GRACE_MS < startDate.getTime()) {
    return {
      allowed: false,
      reason: 'not_started_yet' as const,
    };
  }

  if (!userData.accessEndAt) {
    return {
      allowed: true,
      reason: 'approved_unlimited' as const,
    };
  }

  const endDate = parseAccessDate(userData.accessEndAt);
  if (!endDate) {
    return {
      allowed: false,
      reason: 'invalid_access_end' as const,
    };
  }

  if (now - ACCESS_GRACE_MS > endDate.getTime()) {
    return {
      allowed: false,
      reason: 'expired' as const,
    };
  }

  return {
    allowed: true,
    reason: 'approved' as const,
  };
};

export const getRemainingTimeParts = (
  accessEndAt?: string | Date | FirestoreLikeTimestamp | null
) => {
  if (!accessEndAt) return null;

  const endDate = parseAccessDate(accessEndAt);
  if (!endDate) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const now = Date.now();
  const diff = endDate.getTime() - now;

  if (diff <= 0) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  return {
    totalMs: diff,
    days,
    hours,
    minutes,
  };
};

export const getRemainingTimeLabel = (
  accessEndAt?: string | Date | FirestoreLikeTimestamp | null
) => {
  const parts = getRemainingTimeParts(accessEndAt);

  if (!parts) return 'ללא הגבלה';
  if (parts.totalMs <= 0) return 'הגישה הסתיימה';

  const chunks: string[] = [];

  if (parts.days > 0) chunks.push(`${parts.days} ימים`);
  if (parts.hours > 0) chunks.push(`${parts.hours} שעות`);
  if (parts.minutes > 0 || chunks.length === 0) {
    chunks.push(`${parts.minutes} דקות`);
  }

  return `\u200F${chunks.join(' | ')}\u200F`;
};