'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ShieldCheck, Copy, AlertTriangle, XCircle, RefreshCw, ExternalLink, Info } from 'lucide-react';

type TabKey = 'duplicates' | 'missing_codes' | 'missing_names' | 'conflicts' | 'gbp_conflicts';

const TAB_DOCS: Record<TabKey, { title: string; what: string; why: string; fix: string }> = {
  duplicates: {
    title: 'Duplicate Store Codes',
    what: 'Rows that share the same store_code (case- and whitespace-normalized) as another row in the tracker.',
    why: 'Store codes should uniquely identify one location. Duplicates cause reconciliation to silently pick the "last" row, hiding real differences. Often the result of a copy/paste during data entry or an import overwriting an existing row.',
    fix: 'Open the Tracker, find each duplicate set, and either delete the wrong row or rename one to its real code. Then re-run reconciliation.',
  },
  missing_codes: {
    title: 'Missing Store Codes',
    what: 'Tracker rows with no store_code at all (NULL or empty string).',
    why: 'Without a store_code, the row can\'t be matched against the Google Business Profile snapshot during reconciliation. It will always show as "missing from GBP" even if Google has it.',
    fix: 'Edit the row in the Tracker and add the Google-issued shop code (or your internal SKKE/SKNG/… code if not yet on Google).',
  },
  missing_names: {
    title: 'Missing Business Names',
    what: 'Tracker rows with no business_name.',
    why: 'Business names appear in CSV exports, the dashboard, and the Google Bulk Upload sheet. Empty names result in blank cells on Google\'s side, which fail upload validation.',
    fix: 'Edit the row and enter the official business name (typically "Sun King Shop <City>" or "Sun King <Country> <Location Type>").',
  },
  conflicts: {
    title: 'OV / OU Conflicts',
    what: 'Two sub-checks: (1) rows where both OV and OU are TRUE — logically impossible since OV means "owned & verified on GBP" and OU means "owned but unverified"; (2) rows with no tracker_status set at all.',
    why: 'OV and OU are mutually exclusive. Having both true usually means a stale flag wasn\'t cleared when verification completed. Empty tracker_status leaves a row in limbo — it won\'t show up in any of the dashboard buckets.',
    fix: 'For OV/OU conflicts: unset OU if verification succeeded, or unset OV if it actually failed. For missing status: pick the right value from the Tracker dropdown (Live / In Account / Submitted / Needs Pin / No Claim / Duplicate).',
  },
  gbp_conflicts: {
    title: 'GBP vs Tracker Status Conflicts',
    what: 'Rows where the latest imported GBP CSV says the location is "Published" but the tracker says it\'s anything other than "Live".',
    why: 'This is the most common drift — Google approves a listing but the tracker isn\'t updated to "Live". The dashboard "Live on Google Maps" count under-reports reality until you fix this.',
    fix: 'Use the Reconciliation page → Status Mismatches tab. Each row has an "Apply" button that sets tracker_status to the suggested value. Or click "Apply all suggested" to fix the whole batch at once.',
  },
};

function TabInfoPanel({ tab }: { tab: TabKey }) {
  const doc = TAB_DOCS[tab];
  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-[#F5C000]/5 border-b border-[#F5C000]/20 text-xs text-[#374151]">
      <Info size={14} className="text-[#D4A800] mt-0.5 flex-shrink-0" />
      <div className="space-y-0.5">
        <p><span className="font-semibold text-[#1C2B3A]">What:</span> {doc.what}</p>
        <p><span className="font-semibold text-[#1C2B3A]">Why it matters:</span> {doc.why}</p>
        <p><span className="font-semibold text-[#1C2B3A]">How to fix:</span> {doc.fix}</p>
      </div>
    </div>
  );
}

interface QcData {
  summary: {
    total: number;
    duplicateStoreCodes: number;
    missingStoreCodes: number;
    missingBusinessNames: number;
    ovouConflicts: number;
    noStatus: number;
    gbpStatusConflicts: number;
  };
  duplicateStoreCodes: Array<{ store_code: string; count: number; names: string; countries: string }>;
  missingStoreCodes: Array<{ id: number; business_name: string; country: string; city: string; tracker_status: string }>;
  missingBusinessNames: Array<{ id: number; store_code: string; country: string; city: string; tracker_status: string }>;
  ovouConflicts: Array<{ id: number; store_code: string; business_name: string; country: string; ov: string; ou: string; tracker_status: string }>;
  noStatus: Array<{ id: number; store_code: string; business_name: string; country: string; city: string }>;
  gbpStatusConflicts: Array<{ id: number; store_code: string; business_name: string; tracker_status: string; gbp_status: string; country: string; city: string }>;
}

export default function QualityControlPage() {
  const [data, setData] = useState<QcData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('duplicates');

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/quality-control');
      const json = await res.json();
      if (!res.ok || !json?.summary) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load quality control data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const tabs: Array<{ key: TabKey; label: string; count: number; color: string }> = data ? [
    { key: 'duplicates', label: 'Duplicate Codes', count: data.summary.duplicateStoreCodes, color: 'text-red-600' },
    { key: 'missing_codes', label: 'Missing Codes', count: data.summary.missingStoreCodes, color: 'text-amber-600' },
    { key: 'missing_names', label: 'Missing Names', count: data.summary.missingBusinessNames, color: 'text-amber-600' },
    { key: 'conflicts', label: 'OV/OU Conflicts', count: data.summary.ovouConflicts + data.summary.noStatus, color: 'text-orange-600' },
    { key: 'gbp_conflicts', label: 'GBP Conflicts', count: data.summary.gbpStatusConflicts, color: 'text-purple-600' },
  ] : [];

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Quality Control"
        subtitle="Data integrity checks across the location tracker"
        actions={
          <Button variant="secondary" onClick={fetchData} loading={loading}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />

      {/* Escalate banner */}
      <div className="mx-3 sm:mx-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800 font-medium">Issues found? Raise a support request directly with Google Business Profile.</p>
        <a
          href="https://support.google.com/business?hl=en&sjid=7985649567810165233-EU#topic=11498229"
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 hover:border-red-500 transition-colors"
        >
          <ExternalLink size={14} />
          Escalate to Google Support
        </a>
      </div>

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-2 text-[#F5C000]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running quality checks...
          </div>
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle size={40} className="text-red-500" />
              <p className="text-lg font-semibold text-[#1C2B3A]">Quality check failed</p>
              <p className="text-sm text-gray-600 max-w-md break-words">{error}</p>
              <Button onClick={fetchData} variant="secondary">
                <RefreshCw size={15} /> Retry
              </Button>
            </div>
          </Card>
        ) : data ? (
          <>
            {/* Summary metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard
                label="Total Issues"
                value={data.summary.total}
                accentColor={data.summary.total === 0 ? '#16A34A' : '#DC2626'}
                icon={data.summary.total === 0 ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
              />
              <MetricCard label="Dup. Codes" value={data.summary.duplicateStoreCodes} accentColor="#DC2626" icon={<Copy size={20} />} />
              <MetricCard label="Missing Codes" value={data.summary.missingStoreCodes} accentColor="#D97706" />
              <MetricCard label="Missing Names" value={data.summary.missingBusinessNames} accentColor="#D97706" />
              <MetricCard label="OV/OU Conflicts" value={data.summary.ovouConflicts} accentColor="#EA580C" icon={<XCircle size={20} />} />
              <MetricCard label="GBP Conflicts" value={data.summary.gbpStatusConflicts} accentColor="#7C3AED" />
            </div>

            {data.summary.total === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <ShieldCheck size={40} className="text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-[#1C2B3A]">All checks passed</p>
                  <p className="text-sm text-gray-500 mt-1">No data quality issues detected in the tracker.</p>
                </div>
              </Card>
            ) : (
              <Card padding={false}>
                {/* Tabs */}
                <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
                  {tabs.map(({ key, label, count, color }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === key
                          ? 'border-[#F5C000] text-[#1C2B3A]'
                          : 'border-transparent text-gray-500 hover:text-[#1C2B3A]'
                      }`}
                    >
                      {label}
                      {count > 0 && (
                        <span className={`ml-2 text-xs font-bold ${color}`}>{count}</span>
                      )}
                    </button>
                  ))}
                </div>

                <TabInfoPanel tab={activeTab} />

                <div className="overflow-x-auto">
                  {activeTab === 'duplicates' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Store Code</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Count</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Business Names</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Countries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.duplicateStoreCodes.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No duplicate store codes found.</td></tr>
                        ) : data.duplicateStoreCodes.map((row, i) => (
                          <tr key={i} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-red-700 font-semibold">{row.store_code}</td>
                            <td className="px-4 py-3 text-center font-bold text-red-600">{Number(row.count)}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs max-w-[250px] truncate">{row.names}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{row.countries}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'missing_codes' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Business Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.missingStoreCodes.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">All locations have store codes.</td></tr>
                        ) : data.missingStoreCodes.map((row) => (
                          <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-[#1C2B3A]">{row.business_name || '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{row.country || '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{row.city || '—'}</td>
                            <td className="px-4 py-3"><StatusBadge status={row.tracker_status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'missing_names' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Store Code</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.missingBusinessNames.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">All locations have business names.</td></tr>
                        ) : data.missingBusinessNames.map((row) => (
                          <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-amber-700">{row.store_code || '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{row.country || '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{row.city || '—'}</td>
                            <td className="px-4 py-3"><StatusBadge status={row.tracker_status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'conflicts' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Store Code</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Business Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">OV</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">OU</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ovouConflicts.length === 0 && data.noStatus.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No OV/OU conflicts found.</td></tr>
                        ) : (
                          <>
                            {data.ovouConflicts.map((row) => (
                              <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs">{row.store_code || '—'}</td>
                                <td className="px-4 py-3 font-medium text-[#1C2B3A]">{row.business_name || '—'}</td>
                                <td className="px-4 py-3 text-gray-500">{row.country || '—'}</td>
                                <td className="px-4 py-3 text-center text-green-700 font-semibold text-xs">✓</td>
                                <td className="px-4 py-3 text-center text-blue-600 font-semibold text-xs">✓</td>
                                <td className="px-4 py-3 text-xs text-orange-700 font-medium">Both OV & OU set</td>
                              </tr>
                            ))}
                            {data.noStatus.map((row) => (
                              <tr key={`ns-${row.id}`} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs">{row.store_code || '—'}</td>
                                <td className="px-4 py-3 font-medium text-[#1C2B3A]">{row.business_name || '—'}</td>
                                <td className="px-4 py-3 text-gray-500">{row.country || '—'}</td>
                                <td className="px-4 py-3 text-center text-gray-300 text-xs">·</td>
                                <td className="px-4 py-3 text-center text-gray-300 text-xs">·</td>
                                <td className="px-4 py-3 text-xs text-red-600 font-medium">No status set</td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'gbp_conflicts' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Store Code</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Business Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">GBP Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tracker Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.gbpStatusConflicts.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No GBP vs Tracker status conflicts found.</td></tr>
                        ) : (data.gbpStatusConflicts as Array<{ id: number; store_code: string; business_name: string; tracker_status: string; gbp_status: string; country: string }>).map((row) => (
                          <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs">{row.store_code || '—'}</td>
                            <td className="px-4 py-3 font-medium text-[#1C2B3A] max-w-[180px] truncate">{row.business_name || '—'}</td>
                            <td className="px-4 py-3"><StatusBadge status={row.gbp_status} /></td>
                            <td className="px-4 py-3"><StatusBadge status={row.tracker_status} /></td>
                            <td className="px-4 py-3 text-gray-500">{row.country || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
