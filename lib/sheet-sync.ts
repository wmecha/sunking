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
  'google_maps_url',
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
  'Google Maps URL',
];

/** Aliases used when reading the sheet — handles human variations of the header. */
const HEADER_ALIASES: Record<Column, string[]> = {
  store_code: ['Store Code', 'store_code', 'Shop Code'],
  business_name: ['Business Name', 'business_name', 'Name'],
  country: ['Country', 'country'],
  location_type: ['Location Type', 'location_type', 'Type'],
  ov: ['OV'],
  ou: ['OU'],
  claiming_issue: ['Claiming Issue', 'claiming_issue'],
  action_taken: ['Action Taken', 'action_taken'],
  address: ['Address', 'address'],
  city: ['City', 'city', 'Locality'],
  tracker_status: ['Tracker Status', 'tracker_status', 'Status'],
  google_maps_url: ['Google Maps URL', 'Google Maps Link', 'Maps URL', 'Maps Link', 'GMaps URL', 'Map Link', 'google_maps_url'],
};

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
  // dangerouslySkipVersionCheck: true acknowledges that we're using the SDK-level
  // toolkitVersions: 'latest' setting — without this, the SDK throws
  // ComposioToolVersionRequiredError ("Toolkit version not specified") when it
  // resolves the toolkit version to 'latest' for a "manual execution" caller.
  await composio.tools.execute('GOOGLESHEETS_UPSERT_ROWS', {
    userId,
    version: 'latest',
    dangerouslySkipVersionCheck: true,
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
  // Master Tracker has Google Maps Link at column V, so we read A1:Z to be safe.
  const sheetResp = await composio.tools.execute('GOOGLESHEETS_BATCH_GET', {
    userId,
    version: 'latest',
    dangerouslySkipVersionCheck: true,
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

  // Map sheet column index → DB column name using the first row + alias table.
  const header = rawRows[0].map((h) => h.trim().toLowerCase());
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
  const normalizedHeader = header.map(norm);
  const indexForAnyAlias = (aliases: string[]): number => {
    for (const alias of aliases) {
      const exact = header.indexOf(alias.toLowerCase());
      if (exact >= 0) return exact;
      const loose = normalizedHeader.indexOf(norm(alias));
      if (loose >= 0) return loose;
    }
    return -1;
  };

  const colIdx: Record<Column, number> = Object.fromEntries(
    (COLUMNS as readonly Column[]).map((c) => [c, indexForAnyAlias(HEADER_ALIASES[c])]),
  ) as Record<Column, number>;

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
