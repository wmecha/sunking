import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import getDb from '@/lib/db';
import { accountStatusFromGbpStatus, trackerStatusFromClaimingIssueAndAccount } from '@/lib/status';

interface TrackerSeedRow {
  store_code: string;
  business_name?: string;
  country?: string;
  location_type?: string;
  ov?: string;
  ou?: string;
  claiming_issue?: string;
  action_taken?: string;
  address?: string;
  city?: string;
  tracker_status?: string;
  google_maps_url?: string;
  primary_phone?: string;
  website?: string;
  primary_category?: string;
}

const TRACKER_FIELDS = [
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
  'primary_phone',
  'website',
  'primary_category',
] as const;

function seedPath(...parts: string[]) {
  return path.join(process.cwd(), 'data', 'seeds', ...parts);
}

function readTrackerSeed(): TrackerSeedRow[] {
  return JSON.parse(fs.readFileSync(seedPath('tracker_seed.json'), 'utf-8')) as TrackerSeedRow[];
}

function readGbpSeed(): Array<Record<string, string>> {
  const csv = fs.readFileSync(seedPath('gbp_latest.csv'), 'utf-8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return parsed.data;
}

function rowValue(row: TrackerSeedRow, field: (typeof TRACKER_FIELDS)[number]) {
  const value = row[field];
  return value === '' || value === undefined ? null : value;
}

export async function applyBundledSourceTruth(options: { pruneTracker?: boolean } = {}) {
  const db = getDb();
  const trackerRows = readTrackerSeed();
  const gbpRows = readGbpSeed();
  const chunkSize = 100;

  if (options.pruneTracker && trackerRows.length > 0) {
    const codes = trackerRows.map((row) => row.store_code.trim().toUpperCase()).filter(Boolean);
    await db.execute({
      sql: `
        DELETE FROM tracker_locations
        WHERE UPPER(TRIM(store_code)) NOT IN (${codes.map(() => '?').join(',')})
      `,
      args: codes,
    });
  }

  const insertFields = TRACKER_FIELDS.join(', ');
  const placeholders = TRACKER_FIELDS.map(() => '?').join(', ');
  const updateFields = TRACKER_FIELDS
    .filter((field) => field !== 'store_code')
    .map((field) => `${field} = EXCLUDED.${field}`)
    .join(', ');

  for (let i = 0; i < trackerRows.length; i += chunkSize) {
    const statements = trackerRows.slice(i, i + chunkSize).map((row) => ({
      sql: `
        INSERT INTO tracker_locations (${insertFields})
        VALUES (${placeholders})
        ON CONFLICT (store_code) DO UPDATE SET
          ${updateFields},
          updated_at = NOW()
      `,
      args: TRACKER_FIELDS.map((field) => rowValue(row, field)),
    }));
    await db.batch(statements);
  }

  const published = gbpRows.filter((row) => row.Status?.trim().toLowerCase() === 'published').length;
  const notPublished = gbpRows.filter((row) => row.Status?.trim().toLowerCase() === 'not published').length;
  const duplicate = gbpRows.filter((row) => row.Status?.trim().toLowerCase() === 'duplicate').length;
  const snapshotResult = await db.execute({
    sql: `INSERT INTO gbp_snapshots (filename, imported_at, total_count, published_count, not_published_count, duplicate_count, notes)
          VALUES (?, NOW(), ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      'Sun King Shops-20260522-072948-6c174adc9bb890b4abdee211e6e54e5b.csv',
      gbpRows.length,
      published,
      notPublished,
      duplicate,
      'Bundled source-truth refresh',
    ],
  });
  const snapshotId = Number(snapshotResult.rows[0]?.id);

  for (let i = 0; i < gbpRows.length; i += chunkSize) {
    const statements = gbpRows.slice(i, i + chunkSize).map((row) => ({
      sql: `INSERT INTO gbp_locations (snapshot_id, store_code, business_name, status, address, city, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        snapshotId,
        row['Shop code'] || row['Store code'] || row.store_code || null,
        row['Business name'] || row['Business Name'] || row.business_name || null,
        row.Status || null,
        row['Address line 1'] || row.Address || row.address || null,
        row.Locality || row.City || row.city || null,
        row['Country/Region'] || row.Country || row.country || null,
      ],
    }));
    await db.batch(statements);
  }

  const trackerByCode = new Map(
    trackerRows.map((row) => [row.store_code.trim().toUpperCase(), row])
  );
  const accountUpdates = gbpRows
    .map((row) => {
      const storeCode = (row['Shop code'] || row['Store code'] || row.store_code || '').trim();
      const accountStatus = accountStatusFromGbpStatus(row.Status);
      const trackerRow = trackerByCode.get(storeCode.toUpperCase());
      if (!storeCode || !accountStatus || !trackerRow) return null;
      const trackerStatus = trackerStatusFromClaimingIssueAndAccount(
        { claiming_issue: trackerRow.claiming_issue },
        accountStatus
      );
      return {
        sql: `
          UPDATE tracker_locations
          SET ov = ?, ou = ?, tracker_status = ?, updated_at = NOW()
          WHERE UPPER(TRIM(store_code)) = ?
        `,
        args: [accountStatus.ov, accountStatus.ou, trackerStatus, storeCode.toUpperCase()],
      };
    })
    .filter((stmt): stmt is { sql: string; args: string[] } => stmt !== null);

  for (let i = 0; i < accountUpdates.length; i += chunkSize) {
    await db.batch(accountUpdates.slice(i, i + chunkSize));
  }

  return {
    trackerRows: trackerRows.length,
    pruned: Boolean(options.pruneTracker),
    snapshotId,
    gbpRows: gbpRows.length,
    published,
    notPublished,
    duplicate,
    accountUpdates: accountUpdates.length,
  };
}
