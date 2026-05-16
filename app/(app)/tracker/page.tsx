import { ExternalLink } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { TrackerTable } from '@/components/tracker/TrackerTable';

export default function TrackerPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Location Tracker"
        subtitle="All Sun King locations with claiming status and ownership verification"
        actions={
          <a
            href="https://support.google.com/business?hl=en&sjid=7985649567810165233-EU#topic=11498229"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 hover:border-red-500 transition-colors"
          >
            <ExternalLink size={15} />
            Escalate to Google Support
          </a>
        }
      />
      <div className="p-3 sm:p-6">
        <TrackerTable />
      </div>
    </div>
  );
}
