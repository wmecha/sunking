export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';
import { initializeSchema } from '@/lib/schema';
import { applyBundledSourceTruth } from '@/lib/source-truth';

export async function POST(request: NextRequest) {
  await initializeSchema();

  try {
    const body = await request.json().catch(() => ({}));
    const result = await applyBundledSourceTruth({
      pruneTracker: body?.pruneTracker !== false,
    });

    await logAction('apply_bundled_source_truth', result);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[source-truth/apply] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply source truth' },
      { status: 500 },
    );
  }
}
