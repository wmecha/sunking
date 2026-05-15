export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';

export async function GET() {
  await initializeSchema();
  const db = getDb();
  try {
    const result = await db.execute('SELECT * FROM reconciliation_runs ORDER BY run_at DESC LIMIT 10');
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('[reconcile] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch reconciliation history' }, { status: 500 });
  }
}

export async function POST() {
  await initializeSchema();
  const db = getDb();
  try {
    // Get latest snapshot
    const snapshotResult = await db.execute('SELECT * FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1');
    if (snapshotResult.rows.length === 0) {
      return NextResponse.json({ error: 'No GBP snapshot found. Please import a GBP CSV first.' }, { status: 400 });
    }
    const latestSnapshot = snapshotResult.rows[0] as Record<string, unknown>;

    // Get all GBP locations from latest snapshot
    const gbpResult = await db.execute({
      sql: 'SELECT * FROM gbp_locations WHERE snapshot_id = ?',
      args: [latestSnapshot.id as number],
    });
    const gbpLocations = gbpResult.rows as unknown as Array<{
      id: number; store_code: string; business_name: string; status: string; city: string; country: string;
    }>;

    // Get all tracker locations
    const trackerResult = await db.execute('SELECT * FROM tracker_locations');
    const trackerLocations = trackerResult.rows as unknown as Array<{
      id: number; store_code: string; business_name: string; tracker_status: string; city: string; country: string;
    }>;

    const gbpCodes = new Map(
      gbpLocations.filter((l) => l.store_code).map((l) => [l.store_code.trim().toUpperCase(), l])
    );
    const trackerCodes = new Map(
      trackerLocations.filter((l) => l.store_code).map((l) => [l.store_code.trim().toUpperCase(), l])
    );

    let matched = 0;
    let ovConfirmed = 0;
    let ouConfirmed = 0;
    const missingFromTracker: typeof gbpLocations = [];
    const statusMismatches: Array<{ store_code: string; business_name: string; gbp_status: string; tracker_status: string }> = [];

    for (const gbpLoc of gbpLocations.filter((l) => l.store_code)) {
      const code = gbpLoc.store_code.trim().toUpperCase();
      if (trackerCodes.has(code)) {
        matched++;
        const trackerLoc = trackerCodes.get(code)!;
        const gbpIsLive = gbpLoc.status?.toLowerCase().trim() === 'published';
        const trackerIsLive = trackerLoc.tracker_status === 'Live';
        if (gbpIsLive && !trackerIsLive) {
          statusMismatches.push({
            store_code: code,
            business_name: gbpLoc.business_name || trackerLoc.business_name,
            gbp_status: gbpLoc.status,
            tracker_status: trackerLoc.tracker_status,
          });
        }
        if (gbpIsLive) ovConfirmed++;
        if (!gbpIsLive && trackerLoc.tracker_status === 'In Account') ouConfirmed++;
      } else {
        missingFromTracker.push(gbpLoc);
      }
    }

    const missingFromGbp = trackerLocations.filter((t) => t.store_code && !gbpCodes.has(t.store_code.trim().toUpperCase()));

    const runResult = await db.execute({
      sql: `INSERT INTO reconciliation_runs
              (run_at, snapshot_id, total_gbp, total_tracker, matched, ov_confirmed, ou_confirmed, missing_from_tracker, status_mismatches)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        new Date().toISOString(),
        latestSnapshot.id as number,
        gbpLocations.length,
        trackerLocations.length,
        matched,
        ovConfirmed,
        ouConfirmed,
        missingFromTracker.length,
        statusMismatches.length,
      ],
    });

    return NextResponse.json({
      success: true,
      runId: runResult.lastInsertRowid?.toString(),
      metrics: {
        totalGbp: gbpLocations.length,
        totalTracker: trackerLocations.length,
        matched,
        ovConfirmed,
        ouConfirmed,
        missingFromTracker: missingFromTracker.length,
        statusMismatches: statusMismatches.length,
      },
      details: {
        missingFromTracker: missingFromTracker.slice(0, 100),
        missingFromGbp: missingFromGbp.slice(0, 100),
        statusMismatches: statusMismatches.slice(0, 100),
      },
    });
  } catch (error) {
    console.error('[reconcile] POST error:', error);
    return NextResponse.json({ error: 'Failed to run reconciliation' }, { status: 500 });
  }
}
