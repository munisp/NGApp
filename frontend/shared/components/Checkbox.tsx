'use client';

import React, { forwardRef } from 'react';
import { Check, Minus } from 'lucide-react';

type CheckboxSize = 'sm' | 'md' | 'lg';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  size?: CheckboxSize;
  indeterminate?: boolean;
}

/**
 * Checkbox Component
 * 
 * Checkbox input with label, description, and error states.
 * 
 * Features:
 * - Checked, unchecked, indeterminate states
 * - 3 sizes (sm, md, lg)
 * - Label and description support
 * - Error state with message
 * - Disabled state
 * - Custom styling
 * - forwardRef support
 * 
 * @example
 * ```tsx
 * <Checkbox
 *   label="Accept terms and conditions"
 *   description="You must accept to continue"
 *   checked={accepted}
 *   onChange={(e) => setAccepted(e.target.checked)}
 *   error={error}
 * />
 * ```
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      error,
      size = 'md',
      indeterminate = false,
      className = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const getSizeClass = () => {
      switch (size) {
        case 'sm':
          return 'w-4 h-4';
        case 'md':
          return 'w-5 h-5';
        case 'lg':
          return 'w-6 h-6';
        default:
          return 'w-5 h-5';
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

    const checkboxId = props.id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={className}>
        <div className="flex items-start gap-2">
          <div className="relative flex items-center">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              disabled={disabled}
              className="sr-only peer"
              {...props}
            />
            <div
              className={`
                ${getSizeClass()}
                flex items-center justify-center
                border-2 rounded
                transition-all duration-200
                ${
                  error
                    ? 'border-red-500'
                    : 'border-gray-300 peer-focus:border-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-1'
                }
                ${
                  disabled
                    ? 'bg-gray-100 cursor-not-allowed'
                    : 'bg-white cursor-pointer peer-checked:bg-blue-600 peer-checked:border-blue-600'
                }
              `}
              onClick={() => {
                if (!disabled) {
                  const input = document.getElementById(checkboxId) as HTMLInputElement;
                  input?.click();
                }
              }}
            >
              {props.checked && !indeterminate && (
                <Check className={`${getIconSize()} text-white`} />
              )}
              {indeterminate && (
                <Minus className={`${getIconSize()} text-white`} />
              )}
            </div>
          </div>

          {(label || description) && (
            <div className="flex-1">
              {label && (
                <label
                  htmlFor={checkboxId}
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
          )}
        </div>

        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

/**
 * CheckboxGroup Component
 * 
 * Group of checkboxes with shared label.
 * 
 * @example
 * ```tsx
 * <CheckboxGroup label="Select interests" error={error}>
 *   <Checkbox label="Technology" />
 *   <Checkbox label="Finance" />
 *   <Checkbox label="Sports" />
 * </CheckboxGroup>
 * ```
 */
interface CheckboxGroupProps {
  label?: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
  orientation?: 'vertical' | 'horizontal';
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  label,
  description,
  error,
  children,
  orientation = 'vertical',
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
      <div
        className={`
          flex gap-4
          ${orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'}
        `}
      >
        {children}
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default Checkbox;

