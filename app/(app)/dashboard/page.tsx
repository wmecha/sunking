export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { CountryChart } from '@/components/dashboard/CountryChart';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import { TRACKER_STATUS_ALIASES, type TrackerStatus } from '@/lib/status';
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
  XCircle,
} from 'lucide-react';

interface CountryBreakdown {
  country: string;
  total: number;
  in_account_verified: number;
  in_account_not_verified: number;
  submitted_claim_awaiting_response: number;
  no_claim_option: number;
}

interface SnapshotRow {
  id?: number;
  total_count?: number;
  published_count?: number;
  not_published_count?: number;
  duplicate_count?: number;
  filename?: string;
  imported_at?: string;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusSql(status: TrackerStatus): string {
  return TRACKER_STATUS_ALIASES[status].map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
}

const submittedWorkflowSql = `
  (
    claiming_issue ILIKE '%Awaiting Response%'
    OR tracker_status IN (${statusSql('Submitted Claim Awaiting Response')})
  )
`;

const noClaimWorkflowSql = "claiming_issue ILIKE '%No Claim Option%'";

async function getDashboardData() {
  await initializeSchema();
  const db = getDb();

  const [
    totalResult,
    submittedResult,
    noClaimResult,
    countryResult,
    snapshotResult,
    reconResult,
  ] =
    await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM tracker_locations"),
      db.execute(`SELECT COUNT(*) as count FROM tracker_locations WHERE ${submittedWorkflowSql}`),
      db.execute(`SELECT COUNT(*) as count FROM tracker_locations WHERE ${noClaimWorkflowSql}`),
      db.execute(`
        SELECT
          country,
          COUNT(*) as total,
          SUM(CASE WHEN tracker_status IN (${statusSql('In account verified')}) THEN 1 ELSE 0 END) as in_account_verified,
          SUM(CASE WHEN tracker_status IN (${statusSql('In account not verified')}) THEN 1 ELSE 0 END) as in_account_not_verified,
          SUM(CASE WHEN ${submittedWorkflowSql} THEN 1 ELSE 0 END) as submitted_claim_awaiting_response,
          SUM(CASE WHEN ${noClaimWorkflowSql} THEN 1 ELSE 0 END) as no_claim_option
        FROM tracker_locations
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY total DESC
      `),
      db.execute('SELECT * FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1'),
      db.execute('SELECT * FROM reconciliation_runs ORDER BY run_at DESC LIMIT 1'),
    ]);

  const latestSnapshot = snapshotResult.rows[0] as SnapshotRow | undefined;
  const inAccountVerified = Number(latestSnapshot?.published_count ?? 0);
  const inAccountNotVerified = Number(latestSnapshot
    ? Number(latestSnapshot.not_published_count ?? 0) + Number(latestSnapshot.duplicate_count ?? 0)
    : 0);
  const totalInAccount = Number(latestSnapshot?.total_count ?? (inAccountVerified + inAccountNotVerified));
  const submittedClaimAwaitingResponse = Number(submittedResult.rows[0]?.count ?? 0);
  const noClaimOption = Number(noClaimResult.rows[0]?.count ?? 0);

  return {
    totalLocations: Number(totalResult.rows[0]?.count ?? 0),
    totalInAccount,
    totalNotInAccount: submittedClaimAwaitingResponse + noClaimOption,
    inAccountVerified,
    inAccountNotVerified,
    submittedClaimAwaitingResponse,
    noClaimOption,
    countryBreakdown: countryResult.rows.map((r) => ({
      country: String(r.country ?? ''),
      total: Number(r.total ?? 0),
      in_account_verified: Number(r.in_account_verified ?? 0),
      in_account_not_verified: Number(r.in_account_not_verified ?? 0),
      submitted_claim_awaiting_response: Number(r.submitted_claim_awaiting_response ?? 0),
      no_claim_option: Number(r.no_claim_option ?? 0),
    })) as CountryBreakdown[],
    latestSnapshot,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3 sm:gap-4">
          <Link href="/tracker" className="block hover:-translate-y-0.5 transition-transform">
            <MetricCard
              label="Total locations"
              value={data.totalLocations}
              subtext="Master tracker rows"
              icon={<MapPin size={24} />}
              accentColor="#F5C000"
            />
          </Link>
          <Link href="/tracker?account=in" className="block hover:-translate-y-0.5 transition-transform">
            <MetricCard
              label="Total in account"
              value={data.totalInAccount}
              subtext="Latest GBP export"
              icon={<CheckCircle size={24} />}
              accentColor="#0F766E"
            />
          </Link>
          <Link href="/tracker?account=out" className="block hover:-translate-y-0.5 transition-transform">
            <MetricCard
              label="Total not in account"
              value={data.totalNotInAccount}
              subtext="Submitted + no claim"
              icon={<AlertTriangle size={24} />}
              accentColor="#B45309"
            />
          </Link>
          <Link href="/tracker?gbpStatus=published" className="block hover:-translate-y-0.5 transition-transform">
            <MetricCard
              label="In account verified"
              value={data.inAccountVerified}
              subtext="Owned and verified"
              icon={<CheckCircle size={24} />}
              accentColor="#16A34A"
            />
          </Link>
          <Link href="/tracker?gbpStatus=not_verified" className="block hover:-translate-y-0.5 transition-transform">
            <MetricCard
              label="In account not verified"
              value={data.inAccountNotVerified}
              subtext="In GBP account, not verified"
              icon={<Clock size={24} />}
              accentColor="#2563EB"
            />
          </Link>
          <Link href="/tracker?workflow=submitted" className="block hover:-translate-y-0.5 transition-transform">
            <MetricCard
              label="Submitted claims"
              value={data.submittedClaimAwaitingResponse}
              subtext="Awaiting response"
              icon={<AlertTriangle size={24} />}
              accentColor="#D97706"
            />
          </Link>
          <Link href="/tracker?workflow=no_claim" className="block hover:-translate-y-0.5 transition-transform">
            <MetricCard
              label="No claim option"
              value={data.noClaimOption}
              subtext="No claim path available"
              icon={<XCircle size={24} />}
              accentColor="#DC2626"
            />
          </Link>
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
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Verified</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Not Verified</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">No Claim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.countryBreakdown.map((row) => (
                        <tr key={String(row.country)} className="border-b border-[#E5E7EB] hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-[#1C2B3A]">{String(row.country)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(row.total)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-green-700 font-medium tabular-nums">{Number(row.in_account_verified)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-blue-700 font-medium tabular-nums">{Number(row.in_account_not_verified)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-amber-700 font-medium tabular-nums">{Number(row.submitted_claim_awaiting_response)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-red-700 font-medium tabular-nums">{Number(row.no_claim_option)}</span>
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
                  href="https://business.google.com/groups/117940732771312023601/locations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#1C2B3A] border border-[#F5C000] bg-yellow-50 hover:bg-yellow-100 transition-colors"
                >
                  <ExternalLink size={16} className="text-[#F5C000]" />
                  Go to Google Profile Locations
                </a>
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
