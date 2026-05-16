/**
 * Two-way Google Sheet sync for the Master Tracker.
 *
 * Direction conventions:
 *   - PUSH: DB → Sheet. We overwrite all rows in the sheet (matched by store_code)
 *     with the current DB state. Triggered by the "Push all to Sheet" button.
 *   - PULL: Sheet → DB. We read the sheet, find rows with the same store_code,
 *     and apply field-level updates to the DB. Triggered by the
 *     "Pull from Sheet" button.
 *
 * Only the 11 canonical tracker columns are mirrored:
 *   store_code, business_name, country, location_type, ov, ou,
 *   claiming_issue, action_taken, address, city, tracker_status
 */

import { getComposio, getComposioUserId } from './composio';
import getDb from './db';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1DGAHE9zJ3Dy2VVgs_Jx9lMKYeW4Ox8FLSK7nRgJzWVY';
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'Master Tracker';

// Order matters — this is the header row we'll write to the sheet
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
  'tracker_status',
] as const;
type Column = (typeof COLUMNS)[number];

/** A1-style header row in the sheet — humans see Title Case. */
const HEADERS = [
  'Store Code',
  'Business Name',
  'Country',
  'Location Type',
  'OV',
  'OU',
  'Claiming Issue',
  'Action Taken',
  'Address',
  'City',
  'Tracker Status',
];

type Row = Record<Column, string>;

function toSheetRow(r: Record<string, unknown>): string[] {
  return COLUMNS.map((c) => {
    const v = r[c];
    return v == null ? '' : String(v);
  });
}

// ────────────────────────────────────────────────────────────
// PUSH (DB → Sheet)
// ────────────────────────────────────────────────────────────

export async function pushAllToSheet(): Promise<{ pushed: number }> {
  const db = getDb();
  const composio = getComposio();
  const userId = getComposioUserId();

  const result = await db.execute(
    `SELECT ${COLUMNS.join(', ')} FROM tracker_locations ORDER BY country, business_name`,
  );
  const rows = (result.rows as unknown as Record<string, unknown>[]).map(toSheetRow);

  // GOOGLESHEETS_UPSERT_ROWS matches by keyColumn (Store Code) and updates existing rows or appends new ones.
  // Auto-handles header creation if the sheet is empty.
  await composio.tools.execute('GOOGLESHEETS_UPSERT_ROWS', {
    userId,
    arguments: {
      spreadsheetId: SHEET_ID,
      sheetName: SHEET_TAB,
      headers: HEADERS,
      keyColumn: 'Store Code',
      rows,
      strictMode: false,
    },
  });

  await db.execute(
    `UPDATE tracker_locations SET sheet_synced_at = NOW()`,
  );

  return { pushed: rows.length };
}

// ────────────────────────────────────────────────────────────
// PULL (Sheet → DB)
// ────────────────────────────────────────────────────────────

interface PullSummary {
  total_sheet_rows: number;
  updated: number;
  unchanged: number;
  not_in_db: string[]; // store_codes in sheet but not in DB
  applied_changes: Array<{ store_code: string; changes: Record<string, [unknown, unknown]> }>; // [oldVal, newVal]
}

export async function pullFromSheet(dryRun = false): Promise<PullSummary> {
  const composio = getComposio();
  const userId = getComposioUserId();
  const db = getDb();

  // Read the sheet. Use a bounded range so this doesn't drag on giant sheets.
  // 'Master Tracker'!A1:Z2000 covers 11 columns × up to 2000 rows comfortably.
  const sheetResp = await composio.tools.execute('GOOGLESHEETS_BATCH_GET', {
    userId,
    arguments: {
      spreadsheet_id: SHEET_ID,
      ranges: [`'${SHEET_TAB}'!A1:Z2000`],
      valueRenderOption: 'FORMATTED_VALUE',
    },
  });

  // The response shape from Composio tools is .data — exact path may vary by version.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valueRanges = (sheetResp as any)?.data?.valueRanges
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? (sheetResp as any)?.valueRanges
    ?? [];
  const rawRows: string[][] = valueRanges[0]?.values ?? [];

  if (rawRows.length < 2) {
    return { total_sheet_rows: 0, updated: 0, unchanged: 0, not_in_db: [], applied_changes: [] };
  }

  // Map sheet column index → DB column name using the first row.
  const header = rawRows[0].map((h) => h.trim().toLowerCase());
  const indexFor = (name: string): number => {
    // Try exact match, then loose (no spaces).
    const i = header.indexOf(name.toLowerCase());
    if (i >= 0) return i;
    const collapsed = name.toLowerCase().replace(/[\s_-]/g, '');
    return header.findIndex((h) => h.replace(/[\s_-]/g, '') === collapsed);
  };

  const colIdx: Record<Column, number> = {
    store_code: indexFor('Store Code') >= 0 ? indexFor('Store Code') : indexFor('store_code'),
    business_name: indexFor('Business Name') >= 0 ? indexFor('Business Name') : indexFor('business_name'),
    country: indexFor('Country') >= 0 ? indexFor('Country') : indexFor('country'),
    location_type: indexFor('Location Type') >= 0 ? indexFor('Location Type') : indexFor('location_type'),
    ov: indexFor('OV'),
    ou: indexFor('OU'),
    claiming_issue: indexFor('Claiming Issue') >= 0 ? indexFor('Claiming Issue') : indexFor('claiming_issue'),
    action_taken: indexFor('Action Taken') >= 0 ? indexFor('Action Taken') : indexFor('action_taken'),
    address: indexFor('Address') >= 0 ? indexFor('Address') : indexFor('address'),
    city: indexFor('City') >= 0 ? indexFor('City') : indexFor('city'),
    tracker_status: indexFor('Tracker Status') >= 0 ? indexFor('Tracker Status') : indexFor('tracker_status'),
  };

  if (colIdx.store_code < 0) {
    throw new Error(`Sheet header doesn't contain a 'Store Code' column. Found: ${header.join(', ')}`);
  }

  // Build a map of store_code → sheet row values
  const sheetByCode = new Map<string, Row>();
  for (let r = 1; r < rawRows.length; r++) {
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

  // Fetch matching DB rows
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
      const sheetVal = (sheetRow[c] ?? '').toString().trim();
      const dbVal = (dbRow[c] ?? '').toString().trim();
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

  // Apply (unless dry run)
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
