'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ShieldCheck, Copy, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

type TabKey = 'duplicates' | 'missing_codes' | 'missing_names' | 'conflicts' | 'gbp_conflicts';

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
  const [activeTab, setActiveTab] = useState<TabKey>('duplicates');

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/quality-control');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
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

      <div className="p-6 space-y-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-2 text-[#F5C000]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running quality checks...
          </div>
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
