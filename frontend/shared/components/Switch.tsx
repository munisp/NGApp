'use client';

import React, { forwardRef } from 'react';

type SwitchSize = 'sm' | 'md' | 'lg';

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  size?: SwitchSize;
  onLabel?: string;
  offLabel?: string;
}

/**
 * Switch Component
 * 
 * Toggle switch for boolean states.
 * 
 * Features:
 * - 3 sizes (sm, md, lg)
 * - Label and description support
 * - On/Off labels
 * - Error state
 * - Disabled state
 * - Smooth animations
 * - forwardRef support
 * 
 * @example
 * ```tsx
 * <Switch
 *   label="Enable notifications"
 *   description="Receive email notifications for transactions"
 *   checked={enabled}
 *   onChange={(e) => setEnabled(e.target.checked)}
 *   onLabel="On"
 *   offLabel="Off"
 * />
 * ```
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      description,
      error,
      size = 'md',
      onLabel,
      offLabel,
      className = '',
      disabled = false,
      checked = false,
      ...props
    },
    ref
  ) => {
    const getSwitchSize = () => {
      switch (size) {
        case 'sm':
          return { track: 'w-9 h-5', thumb: 'w-4 h-4', translate: 'translate-x-4' };
        case 'md':
          return { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' };
        case 'lg':
          return { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' };
        default:
          return { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' };
      }
    };

    const getLabelSize = () => {
      switch (size) {
        case 'sm':
          return 'text-sm';
        case 'md':
          return 'text-base';
        case 'lg':
          return 'text-lg';
        default:
          return 'text-base';
      }
    };

    const sizes = getSwitchSize();
    const switchId = props.id || `switch-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={className}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {label && (
              <label
                htmlFor={switchId}
                className={`
                  ${getLabelSize()}
                  font-medium
                  ${disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900 cursor-pointer'}
                `}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-gray-500 mt-0.5">{description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {offLabel && !checked && (
              <span className="text-sm text-gray-500">{offLabel}</span>
            )}
            {onLabel && checked && (
              <span className="text-sm text-blue-600 font-medium">{onLabel}</span>
            )}

            <div className="relative">
              <input
                ref={ref}
                type="checkbox"
                id={switchId}
                disabled={disabled}
                checked={checked}
                className="sr-only peer"
                {...props}
              />
              <div
                className={`
                  ${sizes.track}
                  rounded-full
                  transition-all duration-200
                  ${
                    error
                      ? 'bg-red-200'
                      : disabled
                      ? 'bg-gray-200 cursor-not-allowed'
                      : checked
                      ? 'bg-blue-600'
                      : 'bg-gray-300'
                  }
                  ${!disabled && 'cursor-pointer'}
                  peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-1
                `}
                onClick={() => {
                  if (!disabled) {
                    const input = document.getElementById(switchId) as HTMLInputElement;
                    input?.click();
                  }
                }}
              >
                <div
                  className={`
                    ${sizes.thumb}
                    absolute top-0.5 left-0.5
                    bg-white rounded-full
                    shadow-md
                    transition-transform duration-200
                    ${checked ? sizes.translate : 'translate-x-0'}
                  `}
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
);

Switch.displayName = 'Switch';

/**
 * SwitchGroup Component
 * 
 * Group of switches with shared label.
 * 
 * @example
 * ```tsx
 * <SwitchGroup label="Notification Preferences">
 *   <Switch label="Email notifications" />
 *   <Switch label="SMS notifications" />
 *   <Switch label="Push notifications" />
 * </SwitchGroup>
 * ```
 */
interface SwitchGroupProps {
  label?: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}

export const SwitchGroup: React.FC<SwitchGroupProps> = ({
  label,
  description,
  error,
  children,
}) => {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      {description && (
        <p className="text-sm text-gray-500 mb-3">{description}</p>
      )}
      <div className="flex flex-col gap-4">{children}</div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default Switch;

