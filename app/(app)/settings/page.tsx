export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader } from '@/components/ui/Card';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import { Settings, Database, ShieldCheck, Info } from 'lucide-react';

async function getSettingsData() {
  await initializeSchema();
  const db = getDb();

  const [trackerCount, snapshotCount, gbpCount, reconCount, exportCount, auditCount] = await Promise.all([
    db.execute('SELECT COUNT(*) as n FROM tracker_locations'),
    db.execute('SELECT COUNT(*) as n FROM gbp_snapshots'),
    db.execute('SELECT COUNT(*) as n FROM gbp_locations'),
    db.execute('SELECT COUNT(*) as n FROM reconciliation_runs'),
    db.execute('SELECT COUNT(*) as n FROM export_history'),
    db.execute('SELECT COUNT(*) as n FROM audit_logs'),
  ]);

  const latestSnapshot = await db.execute(
    'SELECT filename, imported_at, total_count FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1'
  );

  return {
    counts: {
      tracker: Number(trackerCount.rows[0]?.n ?? 0),
      snapshots: Number(snapshotCount.rows[0]?.n ?? 0),
      gbpLocations: Number(gbpCount.rows[0]?.n ?? 0),
      reconciliations: Number(reconCount.rows[0]?.n ?? 0),
      exports: Number(exportCount.rows[0]?.n ?? 0),
      auditLogs: Number(auditCount.rows[0]?.n ?? 0),
    },
    latestSnapshot: latestSnapshot.rows[0] as Record<string, unknown> | undefined,
  };
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#E5E7EB] last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-[#1C2B3A] tabular-nums">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const data = await getSettingsData();

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Settings" subtitle="Application configuration and data management" />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* App Info */}
        <Card>
          <CardHeader title="Application" />
          <div className="flex items-start gap-3 p-4 bg-[#F5C000]/10 rounded-lg mb-4">
            <Info size={18} className="text-[#D4A800] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[#1C2B3A]">
              <p className="font-semibold">Sun King Location Intelligence v1.0</p>
              <p className="text-gray-500 mt-0.5">Internal Google Business Profile management and reconciliation tool.</p>
            </div>
          </div>
          <div>
            <StatRow label="Version" value="1.0.0" />
            <StatRow label="Framework" value="Next.js 14 (App Router)" />
            <StatRow label="Database" value="PostgreSQL via Supabase" />
            <StatRow label="Deployment" value="Self-hosted / Node.js" />
          </div>
        </Card>

        {/* Database Stats */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Database size={18} className="text-[#F5C000]" />
            <h2 className="text-base font-semibold text-[#1C2B3A]">Database</h2>
          </div>
          <StatRow label="Tracker locations" value={data.counts.tracker.toLocaleString()} />
          <StatRow label="GBP snapshots" value={data.counts.snapshots.toLocaleString()} />
          <StatRow label="GBP location records" value={data.counts.gbpLocations.toLocaleString()} />
          <StatRow label="Reconciliation runs" value={data.counts.reconciliations.toLocaleString()} />
          <StatRow label="Export history entries" value={data.counts.exports.toLocaleString()} />
          <StatRow label="Audit log entries" value={data.counts.auditLogs.toLocaleString()} />
          {data.latestSnapshot && (
            <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Latest GBP Snapshot</p>
              <p className="text-sm text-[#1C2B3A] font-medium">{String(data.latestSnapshot.filename)}</p>
              <p className="text-xs text-gray-500">
                {Number(data.latestSnapshot.total_count).toLocaleString()} locations ·{' '}
                {new Date(String(data.latestSnapshot.imported_at)).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          )}
        </Card>

        {/* Access Control */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={18} className="text-[#F5C000]" />
            <h2 className="text-base font-semibold text-[#1C2B3A]">Access Control</h2>
          </div>
          <StatRow label="Allowed email domains" value="@sunking.com, @wallacemecha.com" />
          <StatRow label="Session duration" value="7 days" />
          <StatRow label="Authentication" value="Password + domain check" />
          <StatRow label="Cookie type" value="httpOnly, SameSite=Lax" />
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <strong>Note:</strong> To change the app password, update the <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">SUN_KING_APP_PASSWORD</code> variable in <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">.env.local</code> and restart the server.
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Settings size={18} className="text-[#F5C000]" />
            <h2 className="text-base font-semibold text-[#1C2B3A]">Data Management</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            The database file is stored at <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">data/sunking.db</code> in the project root. Back it up regularly.
          </p>
          <div className="space-y-2">
            <a
              href="/api/export"
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-md hover:bg-gray-50 hover:border-[#F5C000] transition-colors"
            >
              Export full tracker as CSV
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            To reset the database, delete <code className="font-mono text-xs">data/sunking.db</code> and restart the server. Seed data will be automatically restored from <code className="font-mono text-xs">data/seeds/</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}
