'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, Filter } from 'lucide-react';

interface ExportHistoryRow {
  id: number;
  exported_at: string;
  filename?: string;
  filter_country?: string;
  filter_status?: string;
  row_count?: number;
}

const COUNTRIES = [
  'Kenya', 'Uganda', 'Tanzania', 'Ghana', 'Nigeria', 'Rwanda',
  'Ethiopia', 'Zambia', 'Malawi', 'DR Congo', 'Senegal',
];

const STATUSES = ['Live', 'In Account', 'Submitted', 'Needs Pin', 'No Claim', 'Duplicate', 'Closed'];
const LOCATION_TYPES = ['Shop', 'Experience Centre', 'Warehouse', 'Head Office'];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ExportPage() {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [locationType, setLocationType] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [history, setHistory] = useState<ExportHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/export?action=history');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setHistory(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchCount = async () => {
      setCountLoading(true);
      try {
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            countries: selectedCountries,
            status: status || undefined,
            location_type: locationType || undefined,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setPreviewCount(json.count);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      } finally {
        setCountLoading(false);
      }
    };

    fetchCount();
    return () => controller.abort();
  }, [selectedCountries, status, locationType]);

  function toggleCountry(c: string) {
    setSelectedCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function handleDownload() {
    const params = new URLSearchParams();
    if (selectedCountries.length > 0) params.set('country', selectedCountries.join(','));
    if (status) params.set('status', status);
    if (locationType) params.set('location_type', locationType);
    window.location.href = `/api/export?${params}`;

    // Refresh history after a short delay to show the new export
    setTimeout(fetchHistory, 1500);
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Export for Google Business Profile"
        subtitle="Generate filtered CSV exports in GBP-compatible format"
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filter Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader title="Filter Options" subtitle="Narrow your export" />

              {/* Countries */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  <Filter size={14} className="inline mr-1" />
                  Countries
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {COUNTRIES.map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCountries.includes(c)}
                        onChange={() => toggleCountry(c)}
                        className="rounded border-[#E5E7EB] text-[#F5C000] focus:ring-[#F5C000]"
                      />
                      <span className="text-sm text-[#374151]">{c}</span>
                    </label>
                  ))}
                </div>
                {selectedCountries.length > 0 && (
                  <button
                    onClick={() => setSelectedCountries([])}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="select-field"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Location Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-1">Location Type</label>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value)}
                  className="select-field"
                >
                  <option value="">All types</option>
                  {LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </Card>
          </div>

          {/* Preview + Download */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader title="Export Preview" />

              {/* Count Preview */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-6 text-center mb-6">
                {countLoading ? (
                  <div className="text-gray-400 text-sm">Calculating...</div>
                ) : (
                  <>
                    <p className="text-5xl font-bold text-[#1C2B3A] tabular-nums">
                      {previewCount ?? '—'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {previewCount === 1 ? 'location matches' : 'locations match'} your filters
                    </p>
                  </>
                )}
              </div>

              {/* Active Filters Summary */}
              <div className="mb-6 text-sm text-gray-500">
                <span className="font-medium text-[#374151]">Active filters: </span>
                {selectedCountries.length > 0 ? (
                  <span className="text-[#1C2B3A]">{selectedCountries.join(', ')}</span>
                ) : (
                  <span>All countries</span>
                )}
                {status && <span> · Status: <span className="text-[#1C2B3A]">{status}</span></span>}
                {locationType && <span> · Type: <span className="text-[#1C2B3A]">{locationType}</span></span>}
              </div>

              {/* Download Button */}
              <Button
                onClick={handleDownload}
                disabled={previewCount === 0}
                size="lg"
                className="w-full justify-center"
              >
                <Download size={18} />
                Download CSV ({previewCount ?? '...'} locations)
              </Button>

              {/* Format note */}
              <p className="text-xs text-gray-400 mt-3 text-center">
                Output columns: Status, Store Code, Business Name, Address, Locality, Country/Region, Location Type, OV Status, OU Status, Claiming Issue, Action Taken
              </p>
            </Card>
          </div>
        </div>

        {/* Export History */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-lg font-semibold text-[#1C2B3A]">Export History</h2>
          </div>
          {historyLoading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">No exports yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Filename</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country Filter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status Filter</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{formatDate(row.exported_at)}</td>
                      <td className="px-4 py-3 text-[#374151] max-w-[200px] truncate">{row.filename || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{row.filter_country || 'All'}</td>
                      <td className="px-4 py-3 text-gray-500">{row.filter_status || 'All'}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{row.row_count ?? '—'}</td>
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
