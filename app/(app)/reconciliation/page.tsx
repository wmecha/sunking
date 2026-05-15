'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { GitCompare, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface ReconciliationRun {
  id: number;
  run_at: string;
  snapshot_id: number;
  total_gbp: number;
  total_tracker: number;
  matched: number;
  ov_confirmed: number;
  ou_confirmed: number;
  missing_from_tracker: number;
  status_mismatches: number;
}

interface ReconciliationDetails {
  missingFromTracker: Array<{
    id: number;
    store_code: string;
    business_name: string;
    status: string;
    city: string;
    country: string;
  }>;
  missingFromGbp: Array<{
    id: number;
    store_code: string;
    business_name: string;
    tracker_status: string;
    city: string;
    country: string;
  }>;
  statusMismatches: Array<{
    store_code: string;
    business_name: string;
    gbp_status: string;
    tracker_status: string;
  }>;
}

interface RunResult {
  metrics: {
    totalGbp: number;
    totalTracker: number;
    matched: number;
    ovConfirmed: number;
    ouConfirmed: number;
    missingFromTracker: number;
    statusMismatches: number;
  };
  details: ReconciliationDetails;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReconciliationPage() {
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'missing_tracker' | 'missing_gbp' | 'mismatches'>('missing_tracker');

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/reconcile');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setRuns(json.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  async function handleRunReconciliation() {
    setRunning(true);
    setError('');
    setRunResult(null);

    try {
      const res = await fetch('/api/reconcile', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Reconciliation failed');
        return;
      }

      setRunResult(data);
      fetchRuns();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  const latestRun = runResult ? null : runs[0];

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Reconciliation"
        subtitle="Compare Tracker data against GBP Account snapshot"
        actions={
          <Button onClick={handleRunReconciliation} loading={running}>
            <GitCompare size={16} />
            Run Reconciliation
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <XCircle size={16} />
            {error}
          </div>
        )}

        {/* Latest results (from a fresh run or most recent historical) */}
        {(runResult || latestRun) && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1C2B3A]">
                {runResult ? 'Reconciliation Results' : `Last Run: ${formatDate(latestRun!.run_at)}`}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard
                label="GBP Total"
                value={runResult ? runResult.metrics.totalGbp : latestRun!.total_gbp}
                accentColor="#F5C000"
              />
              <MetricCard
                label="Tracker Total"
                value={runResult ? runResult.metrics.totalTracker : latestRun!.total_tracker}
                accentColor="#F5C000"
              />
              <MetricCard
                label="Matched"
                value={runResult ? runResult.metrics.matched : latestRun!.matched}
                accentColor="#16A34A"
                icon={<CheckCircle size={20} />}
              />
              <MetricCard
                label="Missing from Tracker"
                value={runResult ? runResult.metrics.missingFromTracker : latestRun!.missing_from_tracker}
                accentColor="#D97706"
                icon={<AlertTriangle size={20} />}
              />
              <MetricCard
                label="Status Mismatches"
                value={runResult ? runResult.metrics.statusMismatches : latestRun!.status_mismatches}
                accentColor="#DC2626"
                icon={<XCircle size={20} />}
              />
            </div>
          </>
        )}

        {/* Detail Tables (only after fresh run) */}
        {runResult && (
          <Card padding={false}>
            {/* Tab Nav */}
            <div className="flex border-b border-[#E5E7EB]">
              {[
                { key: 'missing_tracker' as const, label: `Missing from Tracker (${runResult.details.missingFromTracker.length})` },
                { key: 'missing_gbp' as const, label: `Missing from GBP (${runResult.details.missingFromGbp.length})` },
                { key: 'mismatches' as const, label: `Status Mismatches (${runResult.details.statusMismatches.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-[#F5C000] text-[#1C2B3A]'
                      : 'border-transparent text-gray-500 hover:text-[#1C2B3A]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {activeTab === 'missing_tracker' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Store Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Business Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">GBP Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runResult.details.missingFromTracker.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">All GBP locations are in the tracker.</td></tr>
                    ) : runResult.details.missingFromTracker.map((row) => (
                      <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs">{row.store_code || '—'}</td>
                        <td className="px-4 py-3 font-medium text-[#1C2B3A]">{row.business_name || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3 text-gray-500">{row.city || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{row.country || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'missing_gbp' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Store Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Business Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tracker Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runResult.details.missingFromGbp.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">All tracker locations are in GBP.</td></tr>
                    ) : runResult.details.missingFromGbp.map((row) => (
                      <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs">{row.store_code || '—'}</td>
                        <td className="px-4 py-3 font-medium text-[#1C2B3A]">{row.business_name || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.tracker_status} /></td>
                        <td className="px-4 py-3 text-gray-500">{row.city || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{row.country || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'mismatches' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Store Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Business Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">GBP Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tracker Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runResult.details.statusMismatches.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No status mismatches found.</td></tr>
                    ) : runResult.details.statusMismatches.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs">{row.store_code}</td>
                        <td className="px-4 py-3 font-medium text-[#1C2B3A]">{row.business_name}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.gbp_status} /></td>
                        <td className="px-4 py-3"><StatusBadge status={row.tracker_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}

        {/* Run History */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-lg font-semibold text-[#1C2B3A]">Reconciliation History</h2>
          </div>
          {runs.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No reconciliation runs yet. Click "Run Reconciliation" above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Run Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">GBP Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tracker Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Matched</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Missing</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Mismatches</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{formatDate(run.run_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{run.total_gbp}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{run.total_tracker}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium tabular-nums">{run.matched}</td>
                      <td className="px-4 py-3 text-right text-amber-700 font-medium tabular-nums">{run.missing_from_tracker}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium tabular-nums">{run.status_mismatches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
