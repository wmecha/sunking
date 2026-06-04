import { Suspense } from 'react';
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
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://business.google.com/groups/117940732771312023601/locations"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-[#F5C000] bg-yellow-50 px-3 py-2 text-sm font-semibold text-[#1C2B3A] hover:bg-yellow-100 transition-colors"
            >
              <ExternalLink size={15} />
              GBP Locations
            </a>
            <a
              href="https://support.google.com/business/gethelp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 hover:border-red-500 transition-colors"
            >
              <ExternalLink size={15} />
              Escalate to Google
            </a>
          </div>
        }
      />
      <div className="p-3 sm:p-6">
        <Suspense fallback={<div className="text-sm text-gray-400">Loading tracker...</div>}>
          <TrackerTable />
        </Suspense>
      </div>
    </div>
  );
}
