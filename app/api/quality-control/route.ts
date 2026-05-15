export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';

export async function GET() {
  await initializeSchema();
  const db = getDb();

  try {
    const [dupsResult, missingCodesResult, missingNamesResult, ovouConflictResult, noStatusResult, latestSnapshotResult] =
      await Promise.all([
        // Duplicate store codes (STRING_AGG replaces SQLite GROUP_CONCAT)
        db.execute(`
          SELECT store_code, COUNT(*) as count,
            STRING_AGG(business_name, ' | ') as names,
            STRING_AGG(country, ' | ') as countries
          FROM tracker_locations
          WHERE store_code IS NOT NULL AND store_code != ''
          GROUP BY UPPER(TRIM(store_code))
          HAVING COUNT(*) > 1
          ORDER BY count DESC
        `),
        // Missing store codes
        db.execute(`
          SELECT id, business_name, country, city, tracker_status
          FROM tracker_locations
          WHERE store_code IS NULL OR store_code = ''
          ORDER BY country, business_name
        `),
        // Missing business names
        db.execute(`
          SELECT id, store_code, country, city, tracker_status
          FROM tracker_locations
          WHERE business_name IS NULL OR business_name = ''
          ORDER BY country
        `),
        // OV and OU both true (logical conflict)
        db.execute(`
          SELECT id, store_code, business_name, country, ov, ou, tracker_status
          FROM tracker_locations
          WHERE UPPER(ov) = 'TRUE' AND UPPER(ou) = 'TRUE'
          ORDER BY country, business_name
        `),
        // No tracker status set
        db.execute(`
          SELECT id, store_code, business_name, country, city
          FROM tracker_locations
          WHERE tracker_status IS NULL OR tracker_status = ''
        `),
        // Latest GBP snapshot
        db.execute('SELECT id FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1'),
      ]);

    // GBP status conflicts (Published in GBP but not Live in tracker)
    let gbpConflicts: unknown[] = [];
    if (latestSnapshotResult.rows.length > 0) {
      const snapshotId = latestSnapshotResult.rows[0].id;
      const conflictResult = await db.execute({
        sql: `
          SELECT t.id, t.store_code, t.business_name, t.tracker_status,
                 g.status as gbp_status, t.country, t.city
          FROM tracker_locations t
          JOIN gbp_locations g
            ON UPPER(TRIM(t.store_code)) = UPPER(TRIM(g.store_code))
          WHERE g.snapshot_id = ?
            AND LOWER(g.status) = 'published'
            AND t.tracker_status != 'Live'
          ORDER BY t.country, t.business_name
        `,
        args: [snapshotId as number],
      });
      gbpConflicts = conflictResult.rows;
    }

    const totalIssues =
      dupsResult.rows.length +
      missingCodesResult.rows.length +
      missingNamesResult.rows.length +
      ovouConflictResult.rows.length +
      noStatusResult.rows.length +
      gbpConflicts.length;

    return NextResponse.json({
      summary: {
        total: totalIssues,
        duplicateStoreCodes:  dupsResult.rows.length,
        missingStoreCodes:    missingCodesResult.rows.length,
        missingBusinessNames: missingNamesResult.rows.length,
        ovouConflicts:        ovouConflictResult.rows.length,
        noStatus:             noStatusResult.rows.length,
        gbpStatusConflicts:   gbpConflicts.length,
      },
      duplicateStoreCodes:  dupsResult.rows,
      missingStoreCodes:    missingCodesResult.rows,
      missingBusinessNames: missingNamesResult.rows,
      ovouConflicts:        ovouConflictResult.rows,
      noStatus:             noStatusResult.rows,
      gbpStatusConflicts:   gbpConflicts,
    });
  } catch (error) {
    console.error('[quality-control] GET error:', error);
    return NextResponse.json({ error: 'Failed to run quality control check' }, { status: 500 });
  }
}
