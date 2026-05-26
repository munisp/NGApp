import { useState, useCallback } from 'react';
import { sanitize, validators, validateForm } from '@/lib/validation';

interface FieldError {
  message: string;
  touched: boolean;
}

type ValidationRule = (value: unknown) => string | null;

interface UseFormValidationOptions<T extends Record<string, unknown>> {
  initialValues: T;
  rules: Record<keyof T, ValidationRule[]>;
  onSubmit: (values: T) => void | Promise<void>;
}

export function useFormValidation<T extends Record<string, unknown>>(
  options: UseFormValidationOptions<T>
) {
  const { initialValues, rules, onSubmit } = options;
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const setValue = useCallback((field: keyof T, value: unknown) => {
    const sanitized = typeof value === 'string' ? sanitize(value) : value;
    setValues(prev => ({ ...prev, [field]: sanitized }));
    setIsDirty(true);

    // Validate on change
    const fieldRules = rules[field];
    if (fieldRules) {
      for (const rule of fieldRules) {
        const error = rule(sanitized);
        if (error) {
          setErrors(prev => ({ ...prev, [field as string]: { message: error, touched: true } }));
          return;
        }
      }
      setErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  }, [rules]);

  const validateAll = useCallback((): boolean => {
    const result = validateForm(values as Record<string, unknown>, rules as Record<string, ValidationRule[]>);
    const newErrors: Record<string, FieldError> = {};
    for (const [field, message] of Object.entries(result.errors)) {
      newErrors[field] = { message: message as string, touched: true };
    }
    setErrors(newErrors);
    return result.valid;
  }, [values, rules]);

  const handleSubmit = useCallback(async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!validateAll()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateAll, onSubmit, values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setIsDirty(false);
  }, [initialValues]);

  const getFieldProps = (field: keyof T) => ({
    value: values[field],
    onChange: (e: { target: { value: unknown } }) => setValue(field, e.target.value),
    error: errors[field as string]?.message,
    touched: errors[field as string]?.touched,
  });

  return {
    values,
    errors,
    isSubmitting,
    isDirty,
    isValid: Object.keys(errors).length === 0,
    setValue,
    validateAll,
    handleSubmit,
    reset,
    getFieldProps,
  };
}

// Vertical-specific validation rules
export const telcoValidationRules = {
  msisdn: [(v: unknown) => validators.required(v as string, 'MSISDN'), (v: unknown) => validators.phone(v as string)],
  plan_name: [(v: unknown) => validators.required(v as string, 'Plan name')],
  data_cap_gb: [(v: unknown) => validators.nonNegative(v as string, 'Data cap')],
};

export const commodityValidationRules = {
  instrument: [(v: unknown) => validators.required(v as string, 'Instrument')],
  quantity: [(v: unknown) => validators.required(v as string, 'Quantity'), (v: unknown) => validators.nonNegative(v as string, 'Quantity')],
  price: [(v: unknown) => validators.required(v as string, 'Price'), (v: unknown) => validators.nonNegative(v as string, 'Price')],
  counterparty: [(v: unknown) => validators.required(v as string, 'Counterparty')],
};

export const cpaasValidationRules = {
  app_name: [(v: unknown) => validators.required(v as string, 'App name'), (v: unknown) => validators.maxLength(v as string, 100, 'App name')],
  callback_url: [(v: unknown) => validators.required(v as string, 'Callback URL')],
  sender_id: [(v: unknown) => validators.required(v as string, 'Sender ID'), (v: unknown) => validators.maxLength(v as string, 11, 'Sender ID')],
};
