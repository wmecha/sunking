export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { logAction } from '@/lib/audit';
import { TRACKER_STATUSES, trackerStatusFromClaimingIssueAndAccount, type TrackerStatus } from '@/lib/status';

/**
 * Apply reconciliation suggestions to the tracker.
 *
 * Body shape:
 * {
 *   "updates": [
 *     { "store_code": "SKKE001", "tracker_status": "In account verified", "ov": "TRUE", "ou": "FALSE" },
 *     { "store_code": "SKKE002", "tracker_status": "In account not verified", "ov": "FALSE", "ou": "TRUE" },
 *     ...
 *   ]
 * }
 *
 * Returns: { applied: N, skipped: M, errors: [...] }
 *
 * This endpoint only applies account-state fields from GBP reality:
 * tracker_status, OV, and OU. Names, addresses, locality, and country remain
 * review-only because those can be formatting differences rather than truth.
 */

const ALLOWED_STATUSES = new Set<string>(TRACKER_STATUSES);

export async function POST(request: NextRequest) {
  const db = getDb();
  try {
    const body = await request.json();
    const updates: Array<{ store_code?: string; tracker_status?: string; ov?: string; ou?: string }> = Array.isArray(body?.updates)
      ? body.updates
      : [];

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    let applied = 0;
    let skipped = 0;
    const errors: Array<{ store_code: string; reason: string }> = [];

    for (const u of updates) {
      const code = (u.store_code ?? '').toString().trim();
      const status = (u.tracker_status ?? '').toString().trim();
      const ov = (u.ov ?? '').toString().trim().toUpperCase();
      const ou = (u.ou ?? '').toString().trim().toUpperCase();
      if (!code) { skipped++; continue; }
      if (!ALLOWED_STATUSES.has(status)) {
        errors.push({ store_code: code, reason: `Invalid status '${status}'` });
        continue;
      }
      if (ov && !['TRUE', 'FALSE'].includes(ov)) {
        errors.push({ store_code: code, reason: `Invalid OV value '${ov}'` });
        continue;
      }
      if (ou && !['TRUE', 'FALSE'].includes(ou)) {
        errors.push({ store_code: code, reason: `Invalid OU value '${ou}'` });
        continue;
      }
      try {
        const currentResult = await db.execute({
          sql: `SELECT claiming_issue FROM tracker_locations WHERE UPPER(TRIM(store_code)) = ? LIMIT 1`,
          args: [code.toUpperCase()],
        });
        const current = currentResult.rows[0] as { claiming_issue?: unknown } | undefined;
        if (!current) {
          skipped++;
          continue;
        }
        const finalStatus = trackerStatusFromClaimingIssueAndAccount(
          { claiming_issue: current.claiming_issue },
          { tracker_status: status as TrackerStatus }
        );
        const fields = ['tracker_status = ?'];
        const args: string[] = [finalStatus];
        if (ov) {
          fields.push('ov = ?');
          args.push(ov);
        }
        if (ou) {
          fields.push('ou = ?');
          args.push(ou);
        }
        fields.push('updated_at = NOW()');
        const res = await db.execute({
          sql: `UPDATE tracker_locations SET ${fields.join(', ')} WHERE UPPER(TRIM(store_code)) = ?`,
          args: [...args, code.toUpperCase()],
        });
        // postgres.js doesn't expose rowCount through our wrapper, so just count attempts
        applied++;
        void res;
      } catch (e) {
        errors.push({ store_code: code, reason: e instanceof Error ? e.message : 'Update failed' });
      }
    }

    await logAction('apply_reconciliation_updates', {
      requested: updates.length,
      applied,
      skipped,
      errors: errors.length,
    });

    return NextResponse.json({ applied, skipped, errors });
  } catch (error) {
    console.error('[reconcile/apply] error:', error);
    return NextResponse.json({ error: 'Failed to apply updates' }, { status: 500 });
  }
}
