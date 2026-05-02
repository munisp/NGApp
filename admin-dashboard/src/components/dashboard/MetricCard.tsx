import React from 'react';
import { cn, formatNumber, formatCompactNumber, getPercentageChangeColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'number' | 'compact' | 'currency' | 'percentage' | 'none';
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = 'vs last hour',
  icon,
  trend,
  format = 'none',
  className,
}: MetricCardProps) {
  const formattedValue = React.useMemo(() => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'number':
        return formatNumber(value);
      case 'compact':
        return formatCompactNumber(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'currency':
        return `₦${formatCompactNumber(value)}`;
      default:
        return value.toString();
    }
  }, [value, format]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && (
          <div className="rounded-lg bg-primary-50 p-2 text-primary-600">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-gray-900">{formattedValue}</p>
      </div>
      {change !== undefined && (
        <div className="mt-2 flex items-center">
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
          <span className={cn('ml-1 text-sm font-medium', getPercentageChangeColor(change))}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="ml-2 text-sm text-gray-500">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}

interface MetricGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {children}
    </div>
  );
}
