import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  accentColor?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  accentColor = '#F5C000',
  trend,
}: MetricCardProps) {
  return (
    <div
      className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-5 border-l-4"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-1 text-3xl font-bold text-[#1C2B3A] tabular-nums">{value}</p>
          {subtext && <p className="mt-1 text-xs text-gray-400">{subtext}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-3 text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
