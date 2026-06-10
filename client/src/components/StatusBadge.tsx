import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  // Success states
  SETTLED: 'bg-green-100 text-green-800', CLEARED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800', ACTIVE: 'bg-green-100 text-green-800',
  ACCEPTED: 'bg-green-100 text-green-800', RESOLVED: 'bg-green-100 text-green-800',
  CREDITED: 'bg-green-100 text-green-800', CONFIRMED: 'bg-green-100 text-green-800',
  HEALTHY: 'bg-green-100 text-green-800', RUNNING: 'bg-green-100 text-green-800',
  GREEN: 'bg-green-100 text-green-800', OK: 'bg-green-100 text-green-800',
  CLEAR: 'bg-green-100 text-green-800', ISSUED: 'bg-green-100 text-green-800',
  captured: 'bg-green-100 text-green-800', completed: 'bg-green-100 text-green-800',
  healthy: 'bg-green-100 text-green-800', mitigated: 'bg-green-100 text-green-800',

  // Info / in-progress states
  REVERSED: 'bg-blue-100 text-blue-800', ADVISED: 'bg-blue-100 text-blue-800',
  SCREENING_CLEARED: 'bg-blue-100 text-blue-800', FX_CONVERSION: 'bg-purple-100 text-purple-800',
  CREDITING: 'bg-indigo-100 text-indigo-800', RECEIVED: 'bg-blue-50 text-blue-700',
  processing: 'bg-blue-100 text-blue-800',

  // Warning / pending states
  PENDING_SETTLEMENT: 'bg-amber-100 text-amber-800', PENDING_CLEARING: 'bg-amber-100 text-amber-800',
  PENDING: 'bg-amber-100 text-amber-800', PROCESSING: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800', OPEN: 'bg-amber-100 text-amber-800',
  DRAWN_DOWN: 'bg-amber-100 text-amber-800', SCREENING_HELD: 'bg-amber-100 text-amber-800',
  WARNING: 'bg-amber-100 text-amber-800',
  pending: 'bg-amber-100 text-amber-800',

  // Error states
  RETURNED: 'bg-red-100 text-red-800', FAILED: 'bg-red-100 text-red-800',
  DECLINED: 'bg-red-100 text-red-800', REJECTED: 'bg-red-100 text-red-800',
  DOWN: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800', cancelled: 'bg-red-100 text-red-800',
  critical: 'bg-red-100 text-red-800',

  // Muted states
  SUSPENDED: 'bg-orange-100 text-orange-800',
  EXPIRED: 'bg-gray-100 text-gray-600', DRAFT: 'bg-gray-100 text-gray-600',
  ESCALATED_TO_CBN: 'bg-pink-100 text-pink-800',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap',
      style,
      className
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] || 'bg-gray-100 text-gray-700';
}
