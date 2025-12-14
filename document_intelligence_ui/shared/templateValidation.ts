/**
 * Template Validation Utilities
 * Validates extracted OCR data against template field definitions
 */

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  status: 'valid' | 'invalid' | 'partial';
  errors: ValidationError[];
  warnings: ValidationError[];
  validatedFields: number;
  totalFields: number;
}

export interface TemplateField {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'email' | 'phone' | 'address' | 'boolean';
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
  };
}

/**
 * Validate extracted data against template fields
 */
export function validateAgainstTemplate(
  extractedData: Record<string, any>,
  templateFields: TemplateField[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  let validatedFields = 0;

  for (const field of templateFields) {
    const value = extractedData[field.name];
    const hasValue = value !== undefined && value !== null && value !== '';

    // Check required fields
    if (field.required && !hasValue) {
      errors.push({
        field: field.name,
        message: `Required field "${field.name}" is missing`,
        severity: 'error',
      });
      continue;
    }

    // Skip validation if field is optional and empty
    if (!hasValue) {
      continue;
    }

    // Type validation
    const typeError = validateFieldType(field.name, value, field.type);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    // Validation rules
    if (field.validation) {
      const ruleErrors = validateFieldRules(field.name, value, field.validation, field.type);
      errors.push(...ruleErrors);
    }

    validatedFields++;
  }

  // Determine overall status
  let status: 'valid' | 'invalid' | 'partial';
  if (errors.length === 0) {
    status = 'valid';
  } else if (validatedFields === 0) {
    status = 'invalid';
  } else {
    status = 'partial';
  }

  return {
    isValid: errors.length === 0,
    status,
    errors,
    warnings,
    validatedFields,
    totalFields: templateFields.filter(f => f.required).length,
  };
}

/**
 * Validate field type
 */
function validateFieldType(
  fieldName: string,
  value: any,
  expectedType: TemplateField['type']
): ValidationError | null {
  switch (expectedType) {
    case 'number':
    case 'currency':
      if (typeof value !== 'number' && isNaN(Number(value))) {
        return {
          field: fieldName,
          message: `Field "${fieldName}" must be a number`,
          severity: 'error',
          value,
        };
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        return {
          field: fieldName,
          message: `Field "${fieldName}" must be a valid email address`,
          severity: 'error',
          value,
        };
      }
      break;

    case 'phone':
      // Basic phone validation (digits, spaces, dashes, parentheses, plus)
      const phoneRegex = /^[\d\s\-\(\)\+]+$/;
      if (!phoneRegex.test(String(value))) {
        return {
          field: fieldName,
          message: `Field "${fieldName}" must be a valid phone number`,
          severity: 'error',
          value,
        };
      }
      break;

    case 'date':
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return {
          field: fieldName,
          message: `Field "${fieldName}" must be a valid date`,
          severity: 'error',
          value,
        };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return {
          field: fieldName,
          message: `Field "${fieldName}" must be a boolean value`,
          severity: 'error',
          value,
        };
      }
      break;

    case 'text':
    case 'address':
      if (typeof value !== 'string') {
        return {
          field: fieldName,
          message: `Field "${fieldName}" must be a text value`,
          severity: 'error',
          value,
        };
      }
      break;
  }

  return null;
}

/**
 * Validate field against validation rules
 */
function validateFieldRules(
  fieldName: string,
  value: any,
  rules: NonNullable<TemplateField['validation']>,
  fieldType: TemplateField['type']
): ValidationError[] {
  const errors: ValidationError[] = [];
  const stringValue = String(value);

  // Pattern validation
  if (rules.pattern) {
    try {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(stringValue)) {
        errors.push({
          field: fieldName,
          message: `Field "${fieldName}" does not match required pattern`,
          severity: 'error',
          value,
        });
      }
    } catch (e) {
      console.error(`Invalid regex pattern for field ${fieldName}:`, rules.pattern);
    }
  }

  // Length validation (for text fields)
  if (fieldType === 'text' || fieldType === 'address') {
    if (rules.minLength && stringValue.length < rules.minLength) {
      errors.push({
        field: fieldName,
        message: `Field "${fieldName}" must be at least ${rules.minLength} characters`,
        severity: 'error',
        value,
      });
    }

    if (rules.maxLength && stringValue.length > rules.maxLength) {
      errors.push({
        field: fieldName,
        message: `Field "${fieldName}" must not exceed ${rules.maxLength} characters`,
        severity: 'error',
        value,
      });
    }
  }

  // Value validation (for number fields)
  if (fieldType === 'number' || fieldType === 'currency') {
    const numValue = Number(value);

    if (rules.minValue !== undefined && numValue < rules.minValue) {
      errors.push({
        field: fieldName,
        message: `Field "${fieldName}" must be at least ${rules.minValue}`,
        severity: 'error',
        value,
      });
    }

    if (rules.maxValue !== undefined && numValue > rules.maxValue) {
      errors.push({
        field: fieldName,
        message: `Field "${fieldName}" must not exceed ${rules.maxValue}`,
        severity: 'error',
        value,
      });
    }
  }

  return errors;
}

/**
 * Get validation status badge color
 */
export function getValidationStatusColor(status: string): string {
  switch (status) {
    case 'valid':
      return 'success';
    case 'invalid':
      return 'destructive';
    case 'partial':
      return 'warning';
    default:
      return 'secondary';
  }
}

/**
 * Get validation status label
 */
export function getValidationStatusLabel(status: string): string {
  switch (status) {
    case 'valid':
      return 'Valid';
    case 'invalid':
      return 'Invalid';
    case 'partial':
      return 'Partially Valid';
    case 'not_validated':
      return 'Not Validated';
    default:
      return 'Unknown';
  }
}
