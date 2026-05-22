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

export function normalizeAccountFlag(value: unknown): 'TRUE' | 'FALSE' {
  return isTruthy(value) ? 'TRUE' : 'FALSE';
}

export function workflowStatusFromClaimingIssue(claimingIssue: unknown): Extract<
  TrackerStatus,
  'Submitted Claim Awaiting Response' | 'No claim Option'
> | null {
  const issue = String(claimingIssue ?? '').toLowerCase();

  if (issue.includes('awaiting response')) {
    return 'Submitted Claim Awaiting Response';
  }

  if (issue.includes('no claim option')) {
    return 'No claim Option';
  }

  return null;
}

export function trackerStatusFromClaimingIssueAndAccount(
  row: {
    claiming_issue?: unknown;
    ov?: unknown;
    ou?: unknown;
  },
  accountStatus?: { tracker_status: TrackerStatus } | null
): TrackerStatus {
  const workflowStatus = workflowStatusFromClaimingIssue(row.claiming_issue);
  if (workflowStatus) {
    return workflowStatus;
  }

  if (accountStatus) {
    return accountStatus.tracker_status;
  }

  if (isTruthy(row.ov)) {
    return 'In account verified';
  }

  if (isTruthy(row.ou)) {
    return 'In account not verified';
  }

  return 'In account not verified';
}

/**
 * Column F in the Master Tracker is the operational claim-state source.
 * OV/OU only split clean in-account rows into verified vs not verified.
 */
export function deriveTrackerStatusFromSheet(row: {
  claiming_issue?: unknown;
  ov?: unknown;
  ou?: unknown;
}): TrackerStatus {
  return trackerStatusFromClaimingIssueAndAccount(row);
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
