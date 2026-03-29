export type AccessStatus = 'pending' | 'approved' | 'blocked';

export type UserAccessData = {
  approvalStatus?: AccessStatus;
  accessStartAt?: string | null;
  accessEndAt?: string | null;
  role?: 'admin' | 'client';
};

export const formatDateTimeIL = (value?: string | null) => {
  if (!value) return 'לא הוגדר';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'לא הוגדר';

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

  if (!userData.accessEndAt) {
    return {
      allowed: false,
      reason: 'missing_access_end' as const,
    };
  }

  const now = Date.now();
  const end = new Date(userData.accessEndAt).getTime();

  if (Number.isNaN(end)) {
    return {
      allowed: false,
      reason: 'invalid_access_end' as const,
    };
  }

  if (now > end) {
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

export const getRemainingTimeParts = (accessEndAt?: string | null) => {
  if (!accessEndAt) return null;

  const end = new Date(accessEndAt).getTime();
  const now = Date.now();
  const diff = end - now;

  if (Number.isNaN(end) || diff <= 0) {
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

export const getRemainingTimeLabel = (accessEndAt?: string | null) => {
  const parts = getRemainingTimeParts(accessEndAt);

  if (!parts) return 'לא הוגדר';
  if (parts.totalMs <= 0) return 'הגישה הסתיימה';

  const chunks: string[] = [];

  if (parts.days > 0) chunks.push(`${parts.days} ימים`);
  if (parts.hours > 0) chunks.push(`${parts.hours} שעות`);
  if (parts.minutes > 0 || chunks.length === 0) {
    chunks.push(`${parts.minutes} דקות`);
  }

  return `\u200F${chunks.join(' | ')}\u200F`;
};