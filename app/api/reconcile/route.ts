export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import { logAction } from '@/lib/audit';
import { toIso2 } from '@/lib/countries';
import {
  accountStatusFromGbpStatus,
  normalizeAccountFlag,
  normalizeTrackerStatus,
  trackerStatusFromClaimingIssueAndAccount,
} from '@/lib/status';

function normText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function comparableCountry(value: unknown): string {
  return toIso2(String(value ?? '')).toLowerCase();
}

function isDuplicateGbpRow(status: unknown): boolean {
  return String(status ?? '').trim().toLowerCase() === 'duplicate';
}

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
      id: number; store_code: string; business_name: string; status: string;
      address: string; city: string; country: string;
    }>;

    // Get all tracker locations
    const trackerResult = await db.execute('SELECT * FROM tracker_locations');
    const trackerLocations = trackerResult.rows as unknown as Array<{
      id: number; store_code: string; business_name: string; tracker_status: string;
      address: string; city: string; country: string; ov: string; ou: string; claiming_issue: string;
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
    const statusMismatches: Array<{
      store_code: string; business_name: string;
      gbp_status: string; tracker_status: string;
      direction: 'gbp_ahead' | 'tracker_ahead';
      suggested_tracker_status: string; // what tracker SHOULD say to match GBP
      current_ov: string;
      current_ou: string;
      suggested_ov: string;
      suggested_ou: string;
    }> = [];
    const fieldDiffs: Array<{
      store_code: string; business_name: string; field: string; gbp_value: string; tracker_value: string;
    }> = [];

    for (const gbpLoc of gbpLocations.filter((l) => l.store_code)) {
      const code = gbpLoc.store_code.trim().toUpperCase();
      if (trackerCodes.has(code)) {
        matched++;
        const trackerLoc = trackerCodes.get(code)!;
        const trackerStatus = normalizeTrackerStatus(trackerLoc.tracker_status) || trackerLoc.tracker_status;
        const accountStatus = accountStatusFromGbpStatus(gbpLoc.status);
        const currentOv = normalizeAccountFlag(trackerLoc.ov);
        const currentOu = normalizeAccountFlag(trackerLoc.ou);

        if (accountStatus) {
          const suggestedTrackerStatus = trackerStatusFromClaimingIssueAndAccount(
            { claiming_issue: trackerLoc.claiming_issue },
            accountStatus
          );
          const statusDiff = trackerStatus !== suggestedTrackerStatus;
          const ovDiff = currentOv !== accountStatus.ov;
          const ouDiff = currentOu !== accountStatus.ou;
          if (statusDiff || ovDiff || ouDiff) {
            const direction = accountStatus.tracker_status === 'In account verified'
              ? 'gbp_ahead'
              : 'tracker_ahead';
            statusMismatches.push({
              store_code: code,
              business_name: gbpLoc.business_name || trackerLoc.business_name,
              gbp_status: gbpLoc.status,
              tracker_status: trackerLoc.tracker_status,
              direction,
              suggested_tracker_status: suggestedTrackerStatus,
              current_ov: currentOv,
              current_ou: currentOu,
              suggested_ov: accountStatus.ov,
              suggested_ou: accountStatus.ou,
            });
          }
        }

        // Field-level diff. Tracker `city` is the locality field.
        const fieldChecks: Array<[string, string | undefined, string | undefined]> = [
          ['Business Name', gbpLoc.business_name, trackerLoc.business_name],
          ['Locality',      gbpLoc.city,          trackerLoc.city],
          ['Country',       gbpLoc.country,        trackerLoc.country],
        ];
        for (const [field, gbpVal, trackerVal] of fieldChecks) {
          const differs = field === 'Country'
            ? comparableCountry(gbpVal) !== comparableCountry(trackerVal)
            : normText(gbpVal) !== normText(trackerVal);
          if (gbpVal && trackerVal && differs) {
            fieldDiffs.push({
              store_code: code,
              business_name: gbpLoc.business_name || trackerLoc.business_name,
              field,
              gbp_value: gbpVal,
              tracker_value: trackerVal,
            });
          }
        }

        if (accountStatus?.tracker_status === 'In account verified') ovConfirmed++;
        if (accountStatus?.tracker_status === 'In account not verified') ouConfirmed++;
      } else {
        if (!isDuplicateGbpRow(gbpLoc.status)) {
          missingFromTracker.push(gbpLoc);
        }
      }
    }

    const missingFromGbp = trackerLocations.filter(
      (t) => t.store_code && !gbpCodes.has(t.store_code.trim().toUpperCase())
    );

    const runResult = await db.execute({
      sql: `INSERT INTO reconciliation_runs
              (run_at, snapshot_id, total_gbp, total_tracker, matched, ov_confirmed, ou_confirmed, missing_from_tracker, status_mismatches)
            VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
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
    const runId = String(runResult.rows[0]?.id ?? '');

    await logAction('run_reconciliation', {
      snapshotId: String(latestSnapshot.id),
      totalGbp: gbpLocations.length,
      matched,
      missingFromTracker: missingFromTracker.length,
      statusMismatches: statusMismatches.length,
      fieldDiffs: fieldDiffs.length,
    }, 'reconciliation_run', runId);

    return NextResponse.json({
      success: true,
      runId,
      snapshotId: String(latestSnapshot.id),
      metrics: {
        totalGbp: gbpLocations.length,
        totalTracker: trackerLocations.length,
        matched,
        ovConfirmed,
        ouConfirmed,
        missingFromTracker: missingFromTracker.length,
        statusMismatches: statusMismatches.length,
        fieldDiffs: fieldDiffs.length,
      },
      details: {
        missingFromTracker: missingFromTracker.slice(0, 100),
        missingFromGbp:     missingFromGbp.slice(0, 100),
        statusMismatches:   statusMismatches.slice(0, 100),
        fieldDiffs:         fieldDiffs.slice(0, 200),
      },
    });
  } catch (error) {
    console.error('[reconcile] POST error:', error);
    return NextResponse.json({ error: 'Failed to run reconciliation' }, { status: 500 });
  }
}
