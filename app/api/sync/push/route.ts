export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { pushAllToSheet } from '@/lib/sheet-sync';
import { getSheetSyncDisabledReason, isSheetSyncEnabled } from '@/lib/sheet-sync-config';
import { logAction } from '@/lib/audit';

export async function POST() {
  if (!isSheetSyncEnabled()) {
    return NextResponse.json(
      { error: getSheetSyncDisabledReason() },
      { status: 503 },
    );
  }

  try {
    const result = await pushAllToSheet();
    await logAction('sync_push_to_sheet', { pushed: result.pushed });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[sync/push] error:', error);
    const msg = error instanceof Error ? error.message : 'Sync push failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
