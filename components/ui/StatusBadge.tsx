interface StatusBadgeProps {
  status: string;
}

function getStatusConfig(status: string): { bg: string; text: string; dot: string } {
  const s = status?.toLowerCase().trim() || '';

  if (s === 'in account verified' || s === 'live' || s === 'published') {
    return { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' };
  }
  if (s === 'in account not verified' || s === 'in account' || s === 'in_account') {
    return { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' };
  }
  if (s === 'submitted claim awaiting response' || s === 'submitted') {
    return { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' };
  }
  if (s === 'needs pin' || s === 'needs_pin') {
    return { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' };
  }
  if (s === 'no claim option' || s === 'no claim' || s === 'no_claim') {
    return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' };
  }
  if (s === 'duplicate') {
    return { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' };
  }
  if (s === 'closed') {
    return { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  }
  if (s === 'not published') {
    return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' };
  }

  return { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status || 'Unknown'}
    </span>
  );
}
