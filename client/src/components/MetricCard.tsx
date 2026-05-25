import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const VARIANT_ICON_COLORS: Record<string, string> = {
  default: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-amber-500',
  danger: 'text-red-500',
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <p className={cn(
                'text-xs font-medium',
                trend.value >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          {Icon && (
            <Icon className={cn('h-8 w-8 flex-shrink-0', VARIANT_ICON_COLORS[variant])} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
