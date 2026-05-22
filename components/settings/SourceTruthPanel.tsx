'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2 } from 'lucide-react';

type Status =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

async function readApiResponse(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 500));
  }
}

export function SourceTruthPanel() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function applySourceTruth() {
    if (!confirm('Apply the bundled current tracker and latest GBP export to the app database before pushing to Sheets?')) {
      return;
    }

    setStatus({ kind: 'running' });
    try {
      const res = await fetch('/api/source-truth/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pruneTracker: true }),
      });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || 'Source truth refresh failed');
      setStatus({
        kind: 'success',
        message: `Applied ${json.trackerRows} tracker rows and latest GBP export (${json.gbpRows} rows: ${json.published} published, ${json.notPublished} not published, ${json.duplicate} duplicate).`,
      });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Source truth refresh failed' });
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={applySourceTruth}
        disabled={status.kind === 'running'}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#1C2B3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0F1B2A] disabled:opacity-50"
      >
        {status.kind === 'running' ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Applying source truth...
          </>
        ) : (
          <>
            <DatabaseZap size={16} />
            Apply current source truth to app
          </>
        )}
      </button>

      {status.kind === 'success' && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-green-600" />
          <span>{status.message}</span>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
