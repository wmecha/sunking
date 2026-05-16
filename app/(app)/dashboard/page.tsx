export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { CountryChart } from '@/components/dashboard/CountryChart';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import {
  MapPin,
  CheckCircle,
  AlertTriangle,
  Upload,
  GitCompare,
  Download,
  Clock,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface CountryBreakdown {
  country: string;
  total: number;
  live: number;
  not_live: number;
  submitted: number;
  needs_pin: number;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function getDashboardData() {
  await initializeSchema();
  const db = getDb();

  const [totalResult, liveResult, inAccountResult, needsResult, countryResult, snapshotResult, reconResult] =
    await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM tracker_locations"),
      db.execute("SELECT COUNT(*) as count FROM tracker_locations WHERE tracker_status = 'Live'"),
      db.execute("SELECT COUNT(*) as count FROM tracker_locations WHERE tracker_status = 'In Account'"),
      db.execute("SELECT COUNT(*) as count FROM tracker_locations WHERE tracker_status IN ('Needs Pin', 'No Claim', 'Submitted', 'Duplicate')"),
      db.execute(`
        SELECT
          country,
          COUNT(*) as total,
          SUM(CASE WHEN tracker_status = 'Live' THEN 1 ELSE 0 END) as live,
          SUM(CASE WHEN tracker_status = 'In Account' THEN 1 ELSE 0 END) as not_live,
          SUM(CASE WHEN tracker_status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN tracker_status = 'Needs Pin' THEN 1 ELSE 0 END) as needs_pin
        FROM tracker_locations
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY total DESC
      `),
      db.execute('SELECT * FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1'),
      db.execute('SELECT * FROM reconciliation_runs ORDER BY run_at DESC LIMIT 1'),
    ]);

  return {
    totalInAccount: Number(totalResult.rows[0]?.count ?? 0),
    liveOnMaps: Number(liveResult.rows[0]?.count ?? 0),
    inAccountNotLive: Number(inAccountResult.rows[0]?.count ?? 0),
    needsAttention: Number(needsResult.rows[0]?.count ?? 0),
    countryBreakdown: countryResult.rows.map((r) => ({
      country: String(r.country ?? ''),
      total: Number(r.total ?? 0),
      live: Number(r.live ?? 0),
      not_live: Number(r.not_live ?? 0),
      submitted: Number(r.submitted ?? 0),
      needs_pin: Number(r.needs_pin ?? 0),
    })) as CountryBreakdown[],
    latestSnapshot: snapshotResult.rows[0] as Record<string, unknown> | undefined,
    lastReconciliation: reconResult.rows[0] as Record<string, unknown> | undefined,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Location Intelligence"
        subtitle="Sun King Google Business Profile overview"
      />

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            label="Total in Account"
            value={data.totalInAccount}
            subtext="Across all countries"
            icon={<MapPin size={24} />}
            accentColor="#F5C000"
          />
          <MetricCard
            label="Live on Google Maps"
            value={data.liveOnMaps}
            subtext="Published & verified"
            icon={<CheckCircle size={24} />}
            accentColor="#16A34A"
          />
          <MetricCard
            label="In Account, Not Live"
            value={data.inAccountNotLive}
            subtext="Claimed but not published"
            icon={<Clock size={24} />}
            accentColor="#D97706"
          />
          <MetricCard
            label="Needs Attention"
            value={data.needsAttention}
            subtext="Pending, no claim, or issues"
            icon={<AlertTriangle size={24} />}
            accentColor="#DC2626"
          />
        </div>

        {/* Country Chart */}
        {data.countryBreakdown.length > 0 && (
          <Card>
            <CardHeader title="Location Distribution by Country" />
            <CountryChart data={data.countryBreakdown} />
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Country Breakdown Table */}
          <div className="xl:col-span-2">
            <Card padding={false}>
              <div className="px-6 py-4 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-semibold text-[#1C2B3A]">Country Breakdown</h2>
                <p className="text-sm text-gray-500 mt-0.5">Status breakdown per country</p>
              </div>
              {data.countryBreakdown.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">
                  No data yet. Import a GBP CSV or check your tracker data.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Live</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">In Account</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Needs Pin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.countryBreakdown.map((row) => (
                        <tr key={String(row.country)} className="border-b border-[#E5E7EB] hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-[#1C2B3A]">{String(row.country)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(row.total)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-green-700 font-medium tabular-nums">{Number(row.live)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-blue-700 font-medium tabular-nums">{Number(row.not_live)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-amber-700 font-medium tabular-nums">{Number(row.submitted)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-orange-700 font-medium tabular-nums">{Number(row.needs_pin)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Latest Snapshot */}
            <Card>
              <CardHeader title="Latest GBP Import" />
              {data.latestSnapshot ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">File</span>
                    <span className="text-sm text-[#1C2B3A] font-medium truncate">{String(data.latestSnapshot.filename)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Date</span>
                    <span className="text-sm text-[#374151]">{formatDate(String(data.latestSnapshot.imported_at))}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E7EB]">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#1C2B3A] tabular-nums">{Number(data.latestSnapshot.total_count)}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-700 tabular-nums">{Number(data.latestSnapshot.published_count)}</p>
                      <p className="text-xs text-gray-500">Published</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600 tabular-nums">{Number(data.latestSnapshot.not_published_count)}</p>
                      <p className="text-xs text-gray-500">Not Live</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No snapshots imported yet.</p>
              )}
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader title="Quick Actions" />
              <div className="space-y-2">
                <Link href="/import" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#F5C000] transition-colors">
                  <Upload size={16} className="text-[#F5C000]" />
                  Import GBP CSV
                </Link>
                <Link href="/reconciliation" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#F5C000] transition-colors">
                  <GitCompare size={16} className="text-[#F5C000]" />
                  Run Reconciliation
                </Link>
                <Link href="/export" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#F5C000] transition-colors">
                  <Download size={16} className="text-[#F5C000]" />
                  Export CSV
                </Link>
                <Link href="/quality-control" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#F5C000] transition-colors">
                  <ShieldCheck size={16} className="text-[#F5C000]" />
                  Quality Control
                </Link>
                <a
                  href="https://support.google.com/business?hl=en&sjid=7985649567810165233-EU#topic=11498229"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-400 transition-colors"
                >
                  <ExternalLink size={16} className="text-red-600" />
                  Escalate to Google Support
                </a>
              </div>
            </Card>

            {/* Last Reconciliation */}
            {data.lastReconciliation && (
              <Card>
                <CardHeader title="Last Reconciliation" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Run at</span>
                    <span className="text-[#1C2B3A] font-medium">{formatDate(String(data.lastReconciliation.run_at))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Matched</span>
                    <span className="text-green-700 font-semibold tabular-nums">{Number(data.lastReconciliation.matched)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Missing from Tracker</span>
                    <span className="text-amber-700 font-semibold tabular-nums">{Number(data.lastReconciliation.missing_from_tracker)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
