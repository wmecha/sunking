import { TopBar } from '@/components/layout/TopBar';
import { TrackerTable } from '@/components/tracker/TrackerTable';

export default function TrackerPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Location Tracker"
        subtitle="All Sun King locations with claiming status and ownership verification"
      />
      <div className="p-6">
        <TrackerTable />
      </div>
    </div>
  );
}
