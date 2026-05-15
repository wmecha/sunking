import { MetricCard } from '@/components/ui/MetricCard';
import { MapPin, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface DashboardMetricsProps {
  totalInAccount: number;
  liveOnMaps: number;
  inAccountNotLive: number;
  needsAttention: number;
}

export function DashboardMetrics({
  totalInAccount,
  liveOnMaps,
  inAccountNotLive,
  needsAttention,
}: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard
        label="Total in Account"
        value={totalInAccount}
        subtext="Across all countries"
        icon={<MapPin size={24} />}
        accentColor="#F5C000"
      />
      <MetricCard
        label="Live on Google Maps"
        value={liveOnMaps}
        subtext="Published & verified"
        icon={<CheckCircle size={24} />}
        accentColor="#16A34A"
      />
      <MetricCard
        label="In Account, Not Live"
        value={inAccountNotLive}
        subtext="Claimed but not published"
        icon={<Clock size={24} />}
        accentColor="#D97706"
      />
      <MetricCard
        label="Needs Attention"
        value={needsAttention}
        subtext="Pending, no claim, or issues"
        icon={<AlertTriangle size={24} />}
        accentColor="#DC2626"
      />
    </div>
  );
}
