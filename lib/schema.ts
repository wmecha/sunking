import path from 'path';
import fs from 'fs';
import getDb from '@/lib/db';

/**
 * Schema initialisation.
 * The database schema (tables, indexes) is pre-created in Supabase via SUPABASE_SCHEMA.sql.
 * This function seeds `tracker_locations` from data/seeds/tracker_seed.json on first run
 * (i.e. when the table is empty) and is idempotent on subsequent calls.
 */
export async function initializeSchema(): Promise<void> {
  const db = getDb();

  // Check if the table already has data.
  // If the table doesn't exist yet (schema not applied), the query will throw —
  // catch it gracefully so the page doesn't crash before the schema is applied.
  let count = 0;
  try {
    const countResult = await db.execute('SELECT COUNT(*) as n FROM tracker_locations');
    count = Number(countResult.rows[0]?.n ?? 0);
  } catch (err) {
    console.warn('[schema] tracker_locations table not found — schema has not been applied yet. Skipping seed.', err);
    return;
  }
  await ensureTrackerColumns(db);

  if (count > 0) return; // Already seeded — nothing to do

  // Load seed file
  const seedPath = path.join(process.cwd(), 'data', 'seeds', 'tracker_seed.json');
  if (!fs.existsSync(seedPath)) {
    console.warn('[schema] tracker_seed.json not found — skipping seed');
    return;
  }

  const rows: Array<{
    store_code: string;
    business_name: string;
    country: string;
    location_type: string;
    ov: string;
    ou: string;
    claiming_issue: string;
    action_taken: string;
    address: string;
    city: string;
    tracker_status: string;
    google_maps_url?: string;
    primary_phone?: string;
    website?: string;
    primary_category?: string;
  }> = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  console.log(`[schema] Seeding ${rows.length} tracker locations…`);

  // Insert in batches of 50 to stay well within parameter limits
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const stmts = chunk.map((r) => ({
      sql: `
        INSERT INTO tracker_locations
          (store_code, business_name, country, location_type, ov, ou,
           claiming_issue, action_taken, address, city, tracker_status,
           google_maps_url, primary_phone, website, primary_category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (store_code) DO NOTHING
      `,
      args: [
        r.store_code    ?? null,
        r.business_name ?? null,
        r.country       ?? null,
        r.location_type ?? null,
        r.ov            ?? null,
        r.ou            ?? null,
        r.claiming_issue ?? null,
        r.action_taken  ?? null,
        r.address       ?? null,
        r.city          ?? null,
        r.tracker_status ?? null,
        r.google_maps_url ?? null,
        r.primary_phone ?? null,
        r.website ?? null,
        r.primary_category ?? null,
      ],
    }));

    await db.batch(stmts);
  }

  console.log('[schema] Seed complete.');
}

async function ensureTrackerColumns(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.batch([
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS google_maps_url TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS logo_photo_url TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS cover_photo_url TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS other_photo_urls JSONB' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS primary_phone TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS website TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS primary_category TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS monday_hours TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS tuesday_hours TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS wednesday_hours TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS thursday_hours TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS friday_hours TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS saturday_hours TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS sunday_hours TEXT' },
      { sql: 'ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ' },
    ]);
  } catch (err) {
    console.warn('[schema] Failed to ensure tracker location columns.', err);
  }
}
