export const TRACKER_STATUSES = [
  'In account verified',
  'In account not verified',
  'Submitted Claim Awaiting Response',
  'No claim Option',
] as const;

export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

export const STATUS_LABELS: Record<TrackerStatus, string> = {
  'In account verified': 'In account verified',
  'In account not verified': 'In account not verified',
  'Submitted Claim Awaiting Response': 'Submitted Claim Awaiting Response',
  'No claim Option': 'No claim Option',
};

export const TRACKER_STATUS_ALIASES: Record<TrackerStatus, string[]> = {
  'In account verified': ['In account verified', 'Live'],
  'In account not verified': ['In account not verified', 'In Account', 'Needs Pin', 'Duplicate'],
  'Submitted Claim Awaiting Response': ['Submitted Claim Awaiting Response', 'Submitted'],
  'No claim Option': ['No claim Option', 'No Claim'],
};

function isTruthy(value: unknown): boolean {
  return ['true', 'yes', '1', 'done'].includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Column F in the Master Tracker is the operational claim-state source.
 * For rows already in account, OV decides whether they are verified.
 */
export function deriveTrackerStatusFromSheet(row: {
  claiming_issue?: unknown;
  ov?: unknown;
  ou?: unknown;
}): TrackerStatus {
  const issue = String(row.claiming_issue ?? '').toLowerCase();

  if (isTruthy(row.ov)) {
    return 'In account verified';
  }

  if (isTruthy(row.ou)) {
    return 'In account not verified';
  }

  if (issue.includes('awaiting response')) {
    return 'Submitted Claim Awaiting Response';
  }

  if (issue.includes('no claim option') || issue.includes('no location pin')) {
    return 'No claim Option';
  }

  return isTruthy(row.ov) ? 'In account verified' : 'In account not verified';
}

export function accountStatusFromGbpStatus(status: unknown): {
  tracker_status: TrackerStatus;
  ov: 'TRUE' | 'FALSE';
  ou: 'TRUE' | 'FALSE';
} | null {
  const value = String(status ?? '').trim().toLowerCase();

  if (value === 'published') {
    return { tracker_status: 'In account verified', ov: 'TRUE', ou: 'FALSE' };
  }

  if (value === 'not published' || value === 'duplicate') {
    return { tracker_status: 'In account not verified', ov: 'FALSE', ou: 'TRUE' };
  }

  return null;
}

export function normalizeTrackerStatus(status: unknown): TrackerStatus | '' {
  const value = String(status ?? '').trim().toLowerCase();
  if (!value) return '';

  if (value === 'live' || value === 'published' || value === 'in account verified') {
    return 'In account verified';
  }

  if (
    value === 'in account' ||
    value === 'not published' ||
    value === 'duplicate' ||
    value === 'needs pin' ||
    value === 'in account not verified'
  ) {
    return 'In account not verified';
  }

  if (
    value === 'submitted' ||
    value === 'awaiting response' ||
    value === 'submitted claim awaiting response'
  ) {
    return 'Submitted Claim Awaiting Response';
  }

  if (
    value === 'no claim' ||
    value === 'no_claim' ||
    value === 'no claim option' ||
    value === 'no location pin'
  ) {
    return 'No claim Option';
  }

  return TRACKER_STATUSES.find((s) => s.toLowerCase() === value) ?? '';
}
