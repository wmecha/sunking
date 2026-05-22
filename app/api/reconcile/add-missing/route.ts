export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { logAction } from '@/lib/audit';
import { fromIso2 } from '@/lib/countries';
import { accountStatusFromGbpStatus } from '@/lib/status';

export async function POST(request: NextRequest) {
  const db = getDb();

  try {
    const body = await request.json();
    const snapshotId = Number(body?.snapshot_id);
    const storeCode = String(body?.store_code ?? '').trim();

    if (!snapshotId || !storeCode) {
      return NextResponse.json({ error: 'snapshot_id and store_code are required' }, { status: 400 });
    }

    const gbpResult = await db.execute({
      sql: `
        SELECT *
        FROM gbp_locations
        WHERE snapshot_id = ? AND UPPER(TRIM(store_code)) = UPPER(TRIM(?))
        LIMIT 1
      `,
      args: [snapshotId, storeCode],
    });
    const gbp = gbpResult.rows[0];
    if (!gbp) {
      return NextResponse.json({ error: 'GBP row not found in the selected snapshot' }, { status: 404 });
    }

    const accountStatus = accountStatusFromGbpStatus(gbp.status) ?? {
      tracker_status: 'In account not verified' as const,
      ov: 'FALSE' as const,
      ou: 'TRUE' as const,
    };

    const insertResult = await db.execute({
      sql: `
        INSERT INTO tracker_locations
          (store_code, business_name, country, location_type, ov, ou,
           claiming_issue, action_taken, address, city, tracker_status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON CONFLICT (store_code) DO NOTHING
        RETURNING *
      `,
      args: [
        String(gbp.store_code ?? '').trim(),
        gbp.business_name ?? null,
        fromIso2(String(gbp.country ?? '')),
        'Shop',
        accountStatus.ov,
        accountStatus.ou,
        'Imported from GBP account export',
        'Added from reconciliation missing-from-tracker list',
        gbp.address ?? null,
        gbp.city ?? null,
        accountStatus.tracker_status,
      ],
    });

    const inserted = insertResult.rows[0];
    if (!inserted) {
      return NextResponse.json({ error: 'Tracker row already exists' }, { status: 409 });
    }

    await logAction('add_missing_gbp_location_to_tracker', {
      snapshotId: String(snapshotId),
      storeCode,
      status: gbp.status,
    }, 'tracker_location', String(inserted.id));

    return NextResponse.json({ success: true, data: inserted });
  } catch (error) {
    console.error('[reconcile/add-missing] error:', error);
    return NextResponse.json({ error: 'Failed to add missing location to tracker' }, { status: 500 });
  }
}
