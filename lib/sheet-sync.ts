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

import { getComposio, getComposioConnectedAccountId } from './composio';
import getDb from './db';
import { getGoogleSheetsClient } from './google-sheets';
import { getSheetSyncProvider } from './sheet-sync-config';
import { deriveTrackerStatusFromSheet } from './status';
import { legacyStoreCodesFor, normalizeStoreCode } from './store-code-aliases';

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
  'address',
  'city',
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
  address: ['Address Line 1', 'Address'],
  city: ['Locality', 'City'],
  google_maps_url: ['Google Maps Link', 'Google Maps URL', 'Maps URL', 'Maps Link', 'GMaps URL', 'Map Link'],
};

const CANONICAL_HEADER: string[] = COLUMNS.map((c) => COLUMN_HEADERS[c][0]);

type Row = Record<Column, string>;

interface PullChange {
  store_code: string;
  match_store_code?: string;
  changes: Record<string, [unknown, unknown]>;
}

interface PullSummary {
  total_sheet_rows: number;
  updated: number;
  unchanged: number;
  not_in_db: string[];
  applied_changes: PullChange[];
}

interface PushChange {
  store_code: string;
  mode: 'update' | 'append';
  changes: Record<string, [unknown, unknown]>;
}

interface PushSummary {
  total_db_rows: number;
  updated: number;
  appended: number;
  unchanged: number;
  applied_changes: PushChange[];
}

function toSheetRow(r: Record<string, unknown>): string[] {
  return COLUMNS.map((c) => {
    const v = r[c];
    return v == null ? '' : String(v);
  });
}

function normalizeSheetValue(column: Column, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  return trimmed;
}

/**
 * Wraps a Composio tools.execute call so we surface the underlying error
 * detail instead of the SDK's generic "Error executing the tool".
 */
async function executeTool(toolSlug: string, args: Record<string, unknown>, userId: string) {
  const composio = getComposio();
  const connectedAccountId = getComposioConnectedAccountId();
  try {
    return await composio.tools.execute(toolSlug, {
      userId,
      ...(connectedAccountId ? { connectedAccountId } : {}),
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

async function readSheetRows(): Promise<string[][]> {
  const provider = getSheetSyncProvider();

  if (provider === 'google_service_account') {
    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TAB}'!A1:Z2000`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return (response.data.values ?? []) as string[][];
  }

  if (provider === 'composio') {
    const userId = process.env.COMPOSIO_USER_ID || 'default';
    const sheetResp = await executeTool(
      'GOOGLESHEETS_BATCH_GET',
      {
        spreadsheet_id: SHEET_ID,
        ranges: [`'${SHEET_TAB}'!A1:Z2000`],
        valueRenderOption: 'FORMATTED_VALUE',
      },
      userId,
    );

    const r = sheetResp as any;
    const valueRanges = r?.data?.valueRanges ?? r?.valueRanges ?? r?.data?.response?.data?.valueRanges ?? [];
    return valueRanges[0]?.values ?? [];
  }

  throw new Error('Sheet sync is disabled.');
}

function sheetRowToObject(row: string[], colIdx: Record<Column, number>): Row {
  const obj = {} as Row;
  for (const c of COLUMNS) {
    const idx = colIdx[c];
    obj[c] = idx >= 0 ? (row[idx] ?? '').toString() : '';
  }
  return obj;
}

function diffRows(nextRow: string[], existingRow?: Row): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (let i = 0; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    const nextVal = (nextRow[i] ?? '').toString().trim();
    const oldVal = (existingRow?.[col] ?? '').toString().trim();
    if (nextVal !== oldVal) changes[col] = [oldVal, nextVal];
  }
  return changes;
}

async function getDbSheetRows(): Promise<string[][]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT ${COLUMNS.join(', ')} FROM tracker_locations ORDER BY country, business_name`,
  );
  return (result.rows as unknown as Record<string, unknown>[]).map(toSheetRow);
}

async function buildPushPlan(): Promise<{
  rows: string[][];
  rawRows: string[][];
  headerRowIdx: number;
  colIdx: Record<Column, number>;
  changes: PushChange[];
}> {
  const provider = getSheetSyncProvider();

  if (provider !== 'google_service_account' && provider !== 'composio') {
    throw new Error('Sheet sync is disabled.');
  }

  const rows = await getDbSheetRows();
  const rawRows = await readSheetRows();
  if (rawRows.length === 0) {
    throw new Error(`Push stopped because the sheet tab "${SHEET_TAB}" is empty or inaccessible.`);
  }
  const headerRowIdx = findHeaderRow(rawRows);
  const headerCells = rawRows[headerRowIdx].map((h) => norm(h));
  const colIdx = getColumnIndexes(headerCells);

  const missingHeaders = COLUMNS.filter((c) => colIdx[c] < 0).map((c) => COLUMN_HEADERS[c][0]);
  if (missingHeaders.length > 0) {
    throw new Error(
      `Push stopped because the sheet is missing expected sync header(s): ${missingHeaders.join(', ')}. ` +
        'Add those headers to the Master Tracker sheet before pushing so the app does not update wrong columns.',
    );
  }

  const keyIdx = colIdx.store_code;
  const sheetRowByCode = new Map<string, Row>();
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const code = (rawRows[i][keyIdx] ?? '').toString().trim();
    if (code) sheetRowByCode.set(code, sheetRowToObject(rawRows[i], colIdx));
  }

  const changes: PushChange[] = [];
  for (const row of rows) {
    const code = row[COLUMNS.indexOf('store_code')].trim();
    if (!code) continue;
    const existing = sheetRowByCode.get(code);
    const diff = diffRows(row, existing);
    if (Object.keys(diff).length === 0) continue;
    changes.push({
      store_code: code,
      mode: existing ? 'update' : 'append',
      changes: diff,
    });
  }

  return { rows, rawRows, headerRowIdx, colIdx, changes };
}

async function upsertRowsToSheet(storeCodes?: string[]): Promise<{ updated: number; appended: number; pushed: number }> {
  const provider = getSheetSyncProvider();

  if (provider === 'composio') {
    const rows = await getDbSheetRows();
    const selected = storeCodes?.length
      ? rows.filter((row) => storeCodes.includes(row[COLUMNS.indexOf('store_code')].trim()))
      : rows;
    const userId = process.env.COMPOSIO_USER_ID || 'default';
    await executeTool(
      'GOOGLESHEETS_UPSERT_ROWS',
      {
        spreadsheetId: SHEET_ID,
        sheetName: SHEET_TAB,
        headers: CANONICAL_HEADER,
        keyColumn: 'Store Code',
        rows: selected,
        strictMode: false,
      },
      userId,
    );
    return { updated: selected.length, appended: 0, pushed: selected.length };
  }

  const { rows, rawRows, headerRowIdx, colIdx } = await buildPushPlan();
  const wanted = storeCodes?.length ? new Set(storeCodes) : null;
  const selectedRows = wanted
    ? rows.filter((row) => wanted.has(row[COLUMNS.indexOf('store_code')].trim()))
    : rows;

  const keyIdx = colIdx.store_code;
  const sheetRowByCode = new Map<string, { sheetRowNumber: number; values: string[] }>();
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const code = (rawRows[i][keyIdx] ?? '').toString().trim();
    if (code) sheetRowByCode.set(code, { sheetRowNumber: i + 1, values: rawRows[i] });
  }

  const sheets = getGoogleSheetsClient();
  const minCol = Math.min(...COLUMNS.map((c) => colIdx[c]));
  const maxCol = Math.max(...COLUMNS.map((c) => colIdx[c]));
  const updateRanges: Array<{ range: string; values: string[][] }> = [];
  const appendRows: string[][] = [];

  for (const row of selectedRows) {
    const code = row[COLUMNS.indexOf('store_code')].trim();
    if (!code) continue;

    const existing = sheetRowByCode.get(code);
    if (existing) {
      const next = existing.values.slice(minCol, maxCol + 1);
      for (let i = 0; i < COLUMNS.length; i++) {
        next[colIdx[COLUMNS[i]] - minCol] = row[i] ?? '';
      }
      updateRanges.push({
        range: `'${SHEET_TAB}'!${columnLetter(minCol)}${existing.sheetRowNumber}:${columnLetter(maxCol)}${existing.sheetRowNumber}`,
        values: [next],
      });
    } else {
      const next = new Array(Math.max(rawRows[headerRowIdx].length, maxCol + 1)).fill('');
      for (let i = 0; i < COLUMNS.length; i++) {
        next[colIdx[COLUMNS[i]]] = row[i] ?? '';
      }
      appendRows.push(next);
    }
  }

  if (updateRanges.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updateRanges,
      },
    });
  }

  if (appendRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TAB}'!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: appendRows },
    });
  }

  return {
    updated: updateRanges.length,
    appended: appendRows.length,
    pushed: updateRanges.length + appendRows.length,
  };
}

// ────────────────────────────────────────────────────────────
// PUSH (DB → Sheet)
// ────────────────────────────────────────────────────────────

export async function previewPushToSheet(): Promise<PushSummary> {
  const plan = await buildPushPlan();
  const changedCodes = new Set(plan.changes.map((c) => c.store_code));
  return {
    total_db_rows: plan.rows.filter((row) => row[COLUMNS.indexOf('store_code')].trim()).length,
    updated: plan.changes.filter((c) => c.mode === 'update').length,
    appended: plan.changes.filter((c) => c.mode === 'append').length,
    unchanged: plan.rows.filter((row) => {
      const code = row[COLUMNS.indexOf('store_code')].trim();
      return code && !changedCodes.has(code);
    }).length,
    applied_changes: plan.changes,
  };
}

export async function pushAllToSheet(storeCodes?: string[]): Promise<{ pushed: number; updated: number; appended: number }> {
  const result = await upsertRowsToSheet(storeCodes);
  if (result.pushed > 0) {
    const db = getDb();
    const where = storeCodes?.length
      ? ` WHERE store_code IN (${storeCodes.map(() => '?').join(',')})`
      : '';
    await db.execute({
      sql: `UPDATE tracker_locations SET sheet_synced_at = NOW()${where}`,
      args: storeCodes ?? [],
    });
  }

  return result;
}

// ────────────────────────────────────────────────────────────
// PULL (Sheet → DB)
// ────────────────────────────────────────────────────────────

const norm = (s: string) => (s ?? '').toString().toLowerCase().replace(/[\s_\-\n]/g, '');

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function getColumnIndexes(headerCells: string[]): Record<Column, number> {
  const indexForColumn = (col: Column): number => {
    for (const alias of COLUMN_HEADERS[col]) {
      const ni = headerCells.indexOf(norm(alias));
      if (ni >= 0) return ni;
    }
    return -1;
  };

  return Object.fromEntries(COLUMNS.map((c) => [c, indexForColumn(c)])) as Record<Column, number>;
}

function normText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function rowIdentityKey(row: Partial<Record<Column, unknown>>): string {
  return [
    normText(row.business_name),
    normText(row.country),
    normText(row.city),
  ].join('|');
}

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
  const db = getDb();
  const rawRows = await readSheetRows();

  if (rawRows.length < 2) {
    return { total_sheet_rows: 0, updated: 0, unchanged: 0, not_in_db: [], applied_changes: [] };
  }

  // Auto-detect the header row.
  const headerRowIdx = findHeaderRow(rawRows);
  const headerCells = rawRows[headerRowIdx].map((h) => norm(h));

  const colIdx = getColumnIndexes(headerCells);

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
    sql: `SELECT ${COLUMNS.join(', ')}, tracker_status FROM tracker_locations WHERE store_code IN (${placeholders})`,
    args: codes,
  });
  const allDbResp = await db.execute(`SELECT ${COLUMNS.join(', ')}, tracker_status FROM tracker_locations`);
  const dbByCode = new Map<string, Record<string, unknown>>();
  const allDbByCode = new Map<string, Record<string, unknown>>();
  const allDbByIdentity = new Map<string, Record<string, unknown>[]>();
  for (const row of allDbResp.rows as Record<string, unknown>[]) {
    const code = normalizeStoreCode(row.store_code);
    if (code) allDbByCode.set(code, row);
    const identity = rowIdentityKey(row as Partial<Record<Column, unknown>>);
    if (identity !== '||') {
      const bucket = allDbByIdentity.get(identity) ?? [];
      bucket.push(row);
      allDbByIdentity.set(identity, bucket);
    }
  }
  for (const row of dbResp.rows) {
    const code = normalizeStoreCode((row as Record<string, unknown>).store_code);
    if (code) dbByCode.set(code, row as Record<string, unknown>);
  }

  // Compute diffs
  const applied: PullSummary['applied_changes'] = [];
  const notInDb: string[] = [];
  let unchanged = 0;

  for (const code of Array.from(sheetByCode.keys())) {
    const sheetRow = sheetByCode.get(code)!;
    let matchStoreCode = code;
    let dbRow = dbByCode.get(code);
    if (!dbRow) {
      for (const legacyCode of legacyStoreCodesFor(code)) {
        const legacyRow = allDbByCode.get(normalizeStoreCode(legacyCode));
        if (legacyRow) {
          dbRow = legacyRow;
          matchStoreCode = String(legacyRow.store_code ?? legacyCode);
          break;
        }
      }
    }
    if (!dbRow) {
      const matches = allDbByIdentity.get(rowIdentityKey(sheetRow));
      if (matches?.length === 1) {
        dbRow = matches[0];
        matchStoreCode = String(dbRow.store_code ?? '');
      }
    }
    if (!dbRow) {
      notInDb.push(code);
      continue;
    }
    const changes: Record<string, [unknown, unknown]> = {};
    const dbStoreCode = String(dbRow.store_code ?? '').trim();
    if (dbStoreCode !== code) {
      changes.store_code = [dbStoreCode, code];
    }
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
    const derivedStatus = deriveTrackerStatusFromSheet(sheetRow);
    const dbStatus = (dbRow.tracker_status ?? '').toString().trim();
    if (derivedStatus !== dbStatus) {
      changes.tracker_status = [dbStatus, derivedStatus];
    }
    if (Object.keys(changes).length === 0) {
      unchanged++;
    } else {
      applied.push({ store_code: code, match_store_code: matchStoreCode, changes });
    }
  }

  if (!dryRun) {
    await applyPullChanges(applied);
  }

  return {
    total_sheet_rows: sheetByCode.size,
    updated: applied.length,
    unchanged,
    not_in_db: notInDb,
    applied_changes: applied,
  };
}

export async function applyPullChanges(changesToApply: PullChange[]): Promise<{ applied: number }> {
  if (changesToApply.length === 0) return { applied: 0 };
  const db = getDb();
  const statements = changesToApply.map(({ store_code, match_store_code, changes }) => {
      const fields = Object.keys(changes);
      const setClauses = fields.map((f) => `${f} = ?`);
      setClauses.push('sheet_synced_at = NOW()');
      const values = fields.map((f) => {
        const v = changes[f][1];
        return v === '' ? null : v;
      });
      return {
        sql: `UPDATE tracker_locations SET ${setClauses.join(', ')} WHERE store_code = ?`,
        args: [...values, match_store_code || store_code],
      };
    });

  const chunkSize = 100;
  for (let i = 0; i < statements.length; i += chunkSize) {
    await db.batch(statements.slice(i, i + chunkSize));
  }

  return { applied: changesToApply.length };
}
