'use client';

import React from 'react';
import { X } from 'lucide-react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  rounded?: boolean;
  dot?: boolean;
  icon?: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}

/**
 * Badge Component
 * 
 * Status badge for labels, tags, and indicators.
 * 
 * Features:
 * - 6 variants (default, primary, success, warning, error, info)
 * - 3 sizes (sm, md, lg)
 * - Dot indicator
 * - Custom icon
 * - Removable (with X button)
 * - Rounded or pill-shaped
 * 
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" dot>Pending</Badge>
 * <Badge variant="error" onRemove={() => console.log('Remove')}>
 *   Error
 * </Badge>
 * ```
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  rounded = true,
  dot = false,
  icon,
  onRemove,
  className = '',
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'default':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'primary':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'info':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDotColor = () => {
    switch (variant) {
      case 'default':
        return 'bg-gray-500';
      case 'primary':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
        return 'bg-cyan-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'md':
        return 'px-2.5 py-1 text-sm';
      case 'lg':
        return 'px-3 py-1.5 text-base';
      default:
        return 'px-2.5 py-1 text-sm';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3 h-3';
      case 'md':
        return 'w-4 h-4';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-4 h-4';
    }
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${getSizeClass()}
        ${getVariantClass()}
        border
        ${rounded ? 'rounded-full' : 'rounded'}
        font-medium
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 ${getDotColor()} rounded-full`} />
      )}
      {icon && <span className={getIconSize()}>{icon}</span>}
      <span>{children}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
          aria-label="Remove badge"
        >
          <X className={getIconSize()} />
        </button>
      )}
    </span>
  );
};

/**
 * BadgeGroup Component
 * 
 * Group of badges with consistent spacing.
 * 
 * @example
 * ```tsx
 * <BadgeGroup>
 *   <Badge variant="primary">React</Badge>
 *   <Badge variant="success">TypeScript</Badge>
 *   <Badge variant="info">Tailwind</Badge>
 * </BadgeGroup>
 * ```
 */
interface BadgeGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const BadgeGroup: React.FC<BadgeGroupProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {children}
    </div>
  );
};

/**
 * StatusBadge Component
 * 
 * Pre-configured badge for common statuses.
 * 
 * @example
 * ```tsx
 * <StatusBadge status="active" />
 * <StatusBadge status="pending" />
 * <StatusBadge status="failed" />
 * ```
 */
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'failed' | 'cancelled';
  size?: BadgeSize;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const statusConfig = {
    active: { variant: 'success' as BadgeVariant, label: 'Active', dot: true },
    inactive: { variant: 'default' as BadgeVariant, label: 'Inactive', dot: true },
    pending: { variant: 'warning' as BadgeVariant, label: 'Pending', dot: true },
    completed: { variant: 'success' as BadgeVariant, label: 'Completed', dot: false },
    failed: { variant: 'error' as BadgeVariant, label: 'Failed', dot: false },
    cancelled: { variant: 'default' as BadgeVariant, label: 'Cancelled', dot: false },
  };

  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot={config.dot}
      className={className}
    >
      {config.label}
    </Badge>
  );
};

export default Badge;

