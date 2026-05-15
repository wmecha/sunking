'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader } from '@/components/ui/Card';
import { ImportDropzone } from '@/components/import/ImportDropzone';
import type { GbpSnapshot } from '@/lib/types';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ImportPage() {
  const [snapshots, setSnapshots] = useState<GbpSnapshot[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/import');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setSnapshots(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Import GBP Snapshot"
        subtitle="Upload a Google Business Profile CSV export to update the location database"
      />
      <div className="p-6 space-y-6">
        {/* Upload Zone */}
        <Card>
          <CardHeader
            title="Upload GBP CSV"
            subtitle="Download your export from Google Business Profile Manager and upload it here"
          />
          <ImportDropzone onImportSuccess={fetchHistory} />
        </Card>

        {/* Import History */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-lg font-semibold text-[#1C2B3A]">Import History</h2>
            <p className="text-sm text-gray-500 mt-0.5">Past GBP snapshot imports</p>
          </div>
          {loadingHistory ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : snapshots.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No imports yet. Upload a GBP CSV file above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Filename</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Imported</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Published</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Not Published</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Duplicate</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snap, idx) => (
                    <tr key={snap.id} className="border-b border-[#E5E7EB] hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-[#1C2B3A] max-w-[200px] truncate">{snap.filename}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(snap.imported_at)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{snap.total_count}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-700 font-medium tabular-nums">{snap.published_count}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-red-600 font-medium tabular-nums">{snap.not_published_count}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-purple-700 font-medium tabular-nums">{snap.duplicate_count}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{snap.notes || '—'}</td>
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
