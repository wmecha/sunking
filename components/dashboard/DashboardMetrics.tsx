import { MetricCard } from '@/components/ui/MetricCard';
import { MapPin, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface DashboardMetricsProps {
  totalLocations: number;
  inAccountVerified: number;
  inAccountNotVerified: number;
  submittedClaimAwaitingResponse: number;
  noClaimOption: number;
}

export function DashboardMetrics({
  totalLocations,
  inAccountVerified,
  inAccountNotVerified,
  submittedClaimAwaitingResponse,
  noClaimOption,
}: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <MetricCard
        label="Total locations"
        value={totalLocations}
        subtext="Master tracker rows"
        icon={<MapPin size={24} />}
        accentColor="#F5C000"
      />
      <MetricCard
        label="In account verified"
        value={inAccountVerified}
        subtext="Owned and verified"
        icon={<CheckCircle size={24} />}
        accentColor="#16A34A"
      />
      <MetricCard
        label="In account not verified"
        value={inAccountNotVerified}
        subtext="In GBP account, not verified"
        icon={<Clock size={24} />}
        accentColor="#2563EB"
      />
      <MetricCard
        label="Submitted claims"
        value={submittedClaimAwaitingResponse}
        subtext="Awaiting response"
        icon={<AlertTriangle size={24} />}
        accentColor="#D97706"
      />
      <MetricCard
        label="No claim option"
        value={noClaimOption}
        subtext="No claim path available"
        icon={<XCircle size={24} />}
        accentColor="#DC2626"
      />
    </div>
  );
}
