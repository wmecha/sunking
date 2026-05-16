'use client';

import { useState } from 'react';
import { MapPin, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface GeocodePanelProps {
  enabled: boolean;
  initialRemaining: number;
}

interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number;
  samples?: Array<{ store_code: string; query: string; ok: boolean; formatted?: string }>;
}

export function GeocodePanel({ enabled, initialRemaining }: GeocodePanelProps) {
  const [remaining, setRemaining] = useState<number>(initialRemaining);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BatchResult | null>(null);
  const [totalSucceeded, setTotalSucceeded] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);

  async function runOnce(limit = 50) {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/geocode/batch?limit=${limit}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Geocode failed');
      const r = json as BatchResult;
      setLastResult(r);
      setRemaining(r.remaining);
      setTotalSucceeded((n) => n + r.succeeded);
      setTotalFailed((n) => n + r.failed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geocode failed');
    } finally {
      setRunning(false);
    }
  }

  async function runAll() {
    // Up to 10 batches of 50 to cover ~500 rows. Each call is independent;
    // we stop early if `remaining` hits 0 or we hit an error.
    setError(null);
    setRunning(true);
    try {
      for (let i = 0; i < 15; i++) {
        const res = await fetch(`/api/geocode/batch?limit=50`, { method: 'POST' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Geocode failed');
        const r = json as BatchResult;
        setLastResult(r);
        setRemaining(r.remaining);
        setTotalSucceeded((n) => n + r.succeeded);
        setTotalFailed((n) => n + r.failed);
        if (r.processed === 0 || r.remaining === 0) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geocode failed');
    } finally {
      setRunning(false);
    }
  }

  if (!enabled) {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
        <AlertTriangle size={18} className="text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Geocoding is disabled.</p>
          <p className="text-amber-800 mt-1">
            Set <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">GOOGLE_MAPS_API_KEY</code>
            {' '}on Vercel (enable Maps JavaScript API + Geocoding API in Google Cloud Console first), then redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Remaining" value={remaining} highlight={remaining > 0} />
        <Stat label="Succeeded (session)" value={totalSucceeded} ok={totalSucceeded > 0} />
        <Stat label="Failed (session)" value={totalFailed} bad={totalFailed > 0} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => runOnce(50)}
          disabled={running || remaining === 0}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#1C2B3A] text-[#1C2B3A] hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {running ? <><Loader2 size={14} className="animate-spin" /> Working...</> : <><MapPin size={14} /> Geocode next 50</>}
        </button>
        <button
          onClick={runAll}
          disabled={running || remaining === 0}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-[#F5C000] text-[#1C2B3A] hover:bg-yellow-400 disabled:opacity-50 transition-colors"
        >
          {running ? <><Loader2 size={14} className="animate-spin" /> Geocoding all...</> : <>Geocode all ({remaining})</>}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lastResult && (
        <div className="text-xs text-gray-500 space-y-2">
          <p>
            Last batch — processed {lastResult.processed}, succeeded {lastResult.succeeded},
            failed {lastResult.failed}, skipped {lastResult.skipped}.
          </p>
          {lastResult.samples && lastResult.samples.length > 0 && (
            <details className="bg-gray-50 border border-[#E5E7EB] rounded-md p-2">
              <summary className="cursor-pointer text-gray-700 font-medium">Sample results</summary>
              <ul className="mt-2 space-y-1">
                {lastResult.samples.map((s, i) => (
                  <li key={i} className="text-[11px] font-mono break-all">
                    <span className={s.ok ? 'text-green-700' : 'text-red-700'}>
                      {s.ok ? '✓' : '✗'}
                    </span>{' '}
                    <span className="text-gray-500">{s.store_code}:</span>{' '}
                    <span className="text-gray-700">{s.query}</span>
                    {s.formatted && (
                      <div className="ml-4 text-gray-500">→ {s.formatted}</div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Each address is sent to Google&apos;s Geocoding API ($5 per 1,000 lookups, paid from your $200/month free
        Maps credit). Results are cached in the DB so re-running won&apos;t re-bill rows that already have
        coordinates. Safe to interrupt and resume.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight, ok, bad }: { label: string; value: number; highlight?: boolean; ok?: boolean; bad?: boolean }) {
  let valueColor = 'text-[#1C2B3A]';
  if (highlight) valueColor = 'text-amber-700';
  if (ok) valueColor = 'text-green-700';
  if (bad) valueColor = 'text-red-700';
  return (
    <div className="border border-[#E5E7EB] rounded-md p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

export function GeocodePanelStatus({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-400 inline-flex items-center gap-1">{children} <CheckCircle2 size={12} /></div>;
}
