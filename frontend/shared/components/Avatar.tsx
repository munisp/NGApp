'use client';

import React from 'react';
import { User } from 'lucide-react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  showStatus?: boolean;
  rounded?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * Avatar Component
 * 
 * User avatar with image, initials fallback, and status indicator.
 * 
 * Features:
 * - Image with fallback to initials
 * - Icon fallback if no name
 * - 6 sizes (xs, sm, md, lg, xl, 2xl)
 * - Status indicator (online, offline, away, busy)
 * - Rounded or square
 * - Click handler
 * 
 * @example
 * ```tsx
 * <Avatar
 *   src="/avatar.jpg"
 *   name="John Doe"
 *   size="md"
 *   status="online"
 *   showStatus
 * />
 * 
 * <Avatar name="Jane Smith" size="lg" />
 * ```
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = 'md',
  status,
  showStatus = false,
  rounded = true,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = React.useState(false);

  const getSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'w-6 h-6 text-xs';
      case 'sm':
        return 'w-8 h-8 text-sm';
      case 'md':
        return 'w-10 h-10 text-base';
      case 'lg':
        return 'w-12 h-12 text-lg';
      case 'xl':
        return 'w-16 h-16 text-xl';
      case '2xl':
        return 'w-20 h-20 text-2xl';
      default:
        return 'w-10 h-10 text-base';
    }
  };

  const getStatusSize = () => {
    switch (size) {
      case 'xs':
        return 'w-1.5 h-1.5';
      case 'sm':
        return 'w-2 h-2';
      case 'md':
        return 'w-2.5 h-2.5';
      case 'lg':
        return 'w-3 h-3';
      case 'xl':
        return 'w-3.5 h-3.5';
      case '2xl':
        return 'w-4 h-4';
      default:
        return 'w-2.5 h-2.5';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getGradient = (name: string) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-yellow-500 to-yellow-600',
      'from-red-500 to-red-600',
      'from-indigo-500 to-indigo-600',
      'from-teal-500 to-teal-600',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const showImage = src && !imageError;
  const showInitials = !showImage && name;
  const showIcon = !showImage && !name;

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          ${getSizeClass()}
          ${rounded ? 'rounded-full' : 'rounded-lg'}
          flex items-center justify-center
          overflow-hidden
          ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
          ${showInitials ? `bg-gradient-to-br ${getGradient(name!)} text-white font-semibold` : 'bg-gray-200'}
        `}
        onClick={onClick}
      >
        {showImage && (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
        {showInitials && getInitials(name!)}
        {showIcon && <User className="w-1/2 h-1/2 text-gray-400" />}
      </div>

      {showStatus && status && (
        <span
          className={`
            absolute bottom-0 right-0
            ${getStatusSize()}
            ${getStatusColor()}
            ${rounded ? 'rounded-full' : 'rounded'}
            border-2 border-white
          `}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};

/**
 * AvatarGroup Component
 * 
 * Group of overlapping avatars with count indicator.
 * 
 * @example
 * ```tsx
 * <AvatarGroup max={3}>
 *   <Avatar name="John Doe" src="/john.jpg" />
 *   <Avatar name="Jane Smith" src="/jane.jpg" />
 *   <Avatar name="Bob Johnson" src="/bob.jpg" />
 *   <Avatar name="Alice Williams" src="/alice.jpg" />
 * </AvatarGroup>
 * ```
 */
interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  max = 3,
  size = 'md',
  className = '',
}) => {
  const childrenArray = React.Children.toArray(children);
  const displayedChildren = childrenArray.slice(0, max);
  const remainingCount = childrenArray.length - max;

  const getSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'w-6 h-6 text-xs';
      case 'sm':
        return 'w-8 h-8 text-xs';
      case 'md':
        return 'w-10 h-10 text-sm';
      case 'lg':
        return 'w-12 h-12 text-base';
      case 'xl':
        return 'w-16 h-16 text-lg';
      case '2xl':
        return 'w-20 h-20 text-xl';
      default:
        return 'w-10 h-10 text-sm';
    }
  };

  return (
    <div className={`flex items-center -space-x-2 ${className}`}>
      {displayedChildren.map((child, index) => (
        <div
          key={index}
          className="ring-2 ring-white rounded-full"
          style={{ zIndex: displayedChildren.length - index }}
        >
          {React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<any>, { size })
            : child}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={`
            ${getSizeClass()}
            flex items-center justify-center
            bg-gray-200 text-gray-600 font-semibold
            rounded-full ring-2 ring-white
          `}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export default Avatar;

