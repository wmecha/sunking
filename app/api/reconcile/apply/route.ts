export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { logAction } from '@/lib/audit';
import { TRACKER_STATUSES } from '@/lib/status';

/**
 * Apply reconciliation suggestions to the tracker.
 *
 * Body shape:
 * {
 *   "updates": [
 *     { "store_code": "SKKE001", "tracker_status": "In account verified" },
 *     { "store_code": "SKKE002", "tracker_status": "In account not verified" },
 *     ...
 *   ]
 * }
 *
 * Returns: { applied: N, skipped: M, errors: [...] }
 *
 * Only `tracker_status` can be set here — applying business_name / city / country
 * changes from GBP requires its own decision (do you trust Google's spelling or yours?),
 * so we surface those in the diff list but don't auto-apply.
 */

const ALLOWED_STATUSES = new Set<string>(TRACKER_STATUSES);

export async function POST(request: NextRequest) {
  const db = getDb();
  try {
    const body = await request.json();
    const updates: Array<{ store_code?: string; tracker_status?: string }> = Array.isArray(body?.updates)
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
      if (!code) { skipped++; continue; }
      if (!ALLOWED_STATUSES.has(status)) {
        errors.push({ store_code: code, reason: `Invalid status '${status}'` });
        continue;
      }
      try {
        const res = await db.execute({
          sql: 'UPDATE tracker_locations SET tracker_status = ? WHERE store_code = ?',
          args: [status, code],
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
