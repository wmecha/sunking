/**
 * Two-way Google Sheet sync for the Master Tracker.
 *
 * Design notes:
 * - The Master Tracker sheet has 26+ columns including manually-maintained
 *   ones we don't model (Phil Verified Lat/Lng, Offset, Coord Flag, Phil
 *   Issue Notes, etc.). PUSH must NOT clobber those — we only write to
 *   columns we explicitly list in `headers`. GOOGLESHEETS_UPSERT_ROWS does
 *   partial-column updates by header name.
 * - The sheet has a 3-row banner before the header row, so we detect the
 *   header row by scanning the first N rows for "Store Code".
 * - For each DB column we maintain a list of acceptable sheet header names
 *   so existing sheets with slightly different labels still match.
 */

import { getComposio, getComposioUserId } from './composio';
import getDb from './db';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1DGAHE9zJ3Dy2VVgs_Jx9lMKYeW4Ox8FLSK7nRgJzWVY';
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'Master Tracker';

// Order matters — write order for push.
const COLUMNS = [
  'store_code',
  'business_name',
  'country',
  'location_type',
  'ov',
  'ou',
  'claiming_issue',
  'action_taken',
  'address',
  'city',
  'latitude',
  'longitude',
  'tracker_status',
  'google_maps_url',
] as const;
type Column = (typeof COLUMNS)[number];

/**
 * Sheet header names per DB column. The FIRST entry is the canonical
 * label we write when pushing; subsequent entries are accepted aliases
 * when pulling. This lets us write to the user's existing column names
 * rather than appending fresh ones like "Address" when the sheet
 * already has "Address Line 1".
 */
const COLUMN_HEADERS: Record<Column, string[]> = {
  store_code: ['Store Code'],
  business_name: ['Business Name'],
  country: ['Country'],
  location_type: ['Location Type'],
  ov: ['Owned & Verified', 'OV'],
  ou: ['Owned & Unverified', 'OU'],
  claiming_issue: ['Claiming Exercise Issue Category', 'Claiming Issue', 'Issue Category', 'GBP Consolidation Issue Category'],
  action_taken: ['Action Taken'],
  address: ['Address Line 1', 'Address'],
  city: ['Locality', 'City'],
  latitude: ['Latitude', 'Lat'],
  longitude: ['Longitude', 'Lng', 'Long'],
  tracker_status: ['Tracker Status'],
  google_maps_url: ['Google Maps Link', 'Google Maps URL', 'Maps URL', 'Maps Link', 'GMaps URL', 'Map Link'],
};

const CANONICAL_HEADER: string[] = COLUMNS.map((c) => COLUMN_HEADERS[c][0]);

type Row = Record<Column, string>;

function toSheetRow(r: Record<string, unknown>): string[] {
  return COLUMNS.map((c) => {
    const v = r[c];
    return v == null ? '' : String(v);
  });
}

function normalizeSheetValue(column: Column, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (column === 'latitude' || column === 'longitude') {
    const numeric = Number(trimmed);
    const min = column === 'latitude' ? -90 : -180;
    const max = column === 'latitude' ? 90 : 180;
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) return '';
    return String(numeric);
  }

  return trimmed;
}

/**
 * Wraps a Composio tools.execute call so we surface the underlying error
 * detail instead of the SDK's generic "Error executing the tool".
 */
async function executeTool(toolSlug: string, args: Record<string, unknown>, userId: string) {
  const composio = getComposio();
  try {
    return await composio.tools.execute(toolSlug, {
      userId,
      version: 'latest',
      dangerouslySkipVersionCheck: true,
      arguments: args,
    });
  } catch (err) {
    // The SDK wraps the real cause in .cause; extract everything useful.
    const e = err as any;
    const parts: string[] = [];
    if (e?.message) parts.push(e.message);
    if (e?.cause?.message && e.cause.message !== e.message) parts.push(`Caused by: ${e.cause.message}`);
    if (e?.cause?.response?.body) parts.push(`Response: ${typeof e.cause.response.body === 'string' ? e.cause.response.body : JSON.stringify(e.cause.response.body)}`);
    if (e?.cause?.body) parts.push(`Body: ${typeof e.cause.body === 'string' ? e.cause.body : JSON.stringify(e.cause.body)}`);
    if (e?.response?.body) parts.push(`Response: ${typeof e.response.body === 'string' ? e.response.body : JSON.stringify(e.response.body)}`);
    if (e?.details) parts.push(`Details: ${JSON.stringify(e.details)}`);
    if (parts.length === 0) parts.push('Unknown error from Composio SDK');
    throw new Error(`[${toolSlug}] ${parts.join(' | ')}`);
  }
}

// ────────────────────────────────────────────────────────────
// PUSH (DB → Sheet)
// ────────────────────────────────────────────────────────────

export async function pushAllToSheet(): Promise<{ pushed: number }> {
  const db = getDb();
  const userId = getComposioUserId();

  const result = await db.execute(
    `SELECT ${COLUMNS.join(', ')} FROM tracker_locations ORDER BY country, business_name`,
  );
  const rows = (result.rows as unknown as Record<string, unknown>[]).map(toSheetRow);

  // Partial upsert — UPSERT_ROWS matches by keyColumn and updates only the
  // header columns we send. Other sheet columns (Phil Verified Lat/Lng,
  // Coord Flag, etc.) are preserved.
  await executeTool(
    'GOOGLESHEETS_UPSERT_ROWS',
    {
      spreadsheetId: SHEET_ID,
      sheetName: SHEET_TAB,
      headers: CANONICAL_HEADER,
      keyColumn: 'Store Code',
      rows,
      strictMode: false,
    },
    userId,
  );

  await db.execute(`UPDATE tracker_locations SET sheet_synced_at = NOW()`);

  return { pushed: rows.length };
}

// ────────────────────────────────────────────────────────────
// PULL (Sheet → DB)
// ────────────────────────────────────────────────────────────

interface PullSummary {
  total_sheet_rows: number;
  updated: number;
  unchanged: number;
  not_in_db: string[];
  applied_changes: Array<{ store_code: string; changes: Record<string, [unknown, unknown]> }>;
}

const norm = (s: string) => (s ?? '').toString().toLowerCase().replace(/[\s_\-\n]/g, '');

/**
 * Scan the first N rows for one that contains "Store Code" — handles
 * sheets with a banner / legend / edit-rules block above the real header.
 */
function findHeaderRow(rows: string[][], maxScan = 10): number {
  const target = norm('Store Code');
  const altTarget = norm('Shop Code');
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const found = rows[i].some((cell) => {
      const n = norm(cell);
      return n === target || n === altTarget;
    });
    if (found) return i;
  }
  return 0; // fall back to first row
}

export async function pullFromSheet(dryRun = false): Promise<PullSummary> {
  const userId = getComposioUserId();
  const db = getDb();

  const sheetResp = await executeTool(
    'GOOGLESHEETS_BATCH_GET',
    {
      spreadsheet_id: SHEET_ID,
      ranges: [`'${SHEET_TAB}'!A1:Z2000`],
      valueRenderOption: 'FORMATTED_VALUE',
    },
    userId,
  );

  // Response shape from Composio: { data: { valueRanges: [{ values: [[...]] }] } }
  const r = sheetResp as any;
  const valueRanges = r?.data?.valueRanges ?? r?.valueRanges ?? r?.data?.response?.data?.valueRanges ?? [];
  const rawRows: string[][] = valueRanges[0]?.values ?? [];

  if (rawRows.length < 2) {
    return { total_sheet_rows: 0, updated: 0, unchanged: 0, not_in_db: [], applied_changes: [] };
  }

  // Auto-detect the header row.
  const headerRowIdx = findHeaderRow(rawRows);
  const headerCells = rawRows[headerRowIdx].map((h) => norm(h));

  const indexForColumn = (col: Column): number => {
    for (const alias of COLUMN_HEADERS[col]) {
      const ni = headerCells.indexOf(norm(alias));
      if (ni >= 0) return ni;
    }
    return -1;
  };

  const colIdx: Record<Column, number> = Object.fromEntries(
    COLUMNS.map((c) => [c, indexForColumn(c)]),
  ) as Record<Column, number>;

  if (colIdx.store_code < 0) {
    throw new Error(
      `Sheet header doesn't contain a 'Store Code' column. ` +
      `Looked at row ${headerRowIdx + 1}. Found: ${rawRows[headerRowIdx].join(' | ').slice(0, 200)}`,
    );
  }

  // Build map of store_code → sheet row values
  const sheetByCode = new Map<string, Row>();
  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const code = (row[colIdx.store_code] ?? '').toString().trim();
    if (!code) continue;
    const obj = {} as Row;
    for (const c of COLUMNS) {
      const idx = colIdx[c];
      obj[c] = idx >= 0 ? (row[idx] ?? '').toString() : '';
    }
    sheetByCode.set(code, obj);
  }

  const codes = Array.from(sheetByCode.keys());
  if (codes.length === 0) {
    return { total_sheet_rows: 0, updated: 0, unchanged: 0, not_in_db: [], applied_changes: [] };
  }

  const placeholders = codes.map(() => '?').join(',');
  const dbResp = await db.execute({
    sql: `SELECT ${COLUMNS.join(', ')} FROM tracker_locations WHERE store_code IN (${placeholders})`,
    args: codes,
  });
  const dbByCode = new Map<string, Record<string, unknown>>();
  for (const row of dbResp.rows) {
    const code = String((row as Record<string, unknown>).store_code ?? '');
    if (code) dbByCode.set(code, row as Record<string, unknown>);
  }

  // Compute diffs
  const applied: PullSummary['applied_changes'] = [];
  const notInDb: string[] = [];
  let unchanged = 0;

  for (const code of Array.from(sheetByCode.keys())) {
    const sheetRow = sheetByCode.get(code)!;
    const dbRow = dbByCode.get(code);
    if (!dbRow) {
      notInDb.push(code);
      continue;
    }
    const changes: Record<string, [unknown, unknown]> = {};
    for (const c of COLUMNS) {
      if (c === 'store_code') continue;
      // Sheet may have empty cells we don't want to use to wipe DB values.
      // Treat empty-string sheet values as "no opinion" — skip them.
      const sheetVal = normalizeSheetValue(c, (sheetRow[c] ?? '').toString());
      const dbVal = (dbRow[c] ?? '').toString().trim();
      if (sheetVal === '') continue;
      if (sheetVal !== dbVal) {
        changes[c] = [dbVal, sheetVal];
      }
    }
    if (Object.keys(changes).length === 0) {
      unchanged++;
    } else {
      applied.push({ store_code: code, changes });
    }
  }

  if (!dryRun) {
    for (const { store_code, changes } of applied) {
      const fields = Object.keys(changes);
      const setClauses = fields.map((f) => `${f} = ?`);
      setClauses.push('sheet_synced_at = NOW()');
      const values = fields.map((f) => {
        const v = changes[f][1];
        return v === '' ? null : v;
      });
      await db.execute({
        sql: `UPDATE tracker_locations SET ${setClauses.join(', ')} WHERE store_code = ?`,
        args: [...values, store_code],
      });
    }
  }

  return {
    total_sheet_rows: sheetByCode.size,
    updated: applied.length,
    unchanged,
    not_in_db: notInDb,
    applied_changes: applied,
  };
}
