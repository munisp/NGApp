/**
 * Document Templates for Common Document Types
 * 
 * Pre-configured extraction templates to improve OCR accuracy
 * and reduce manual review time for standard document formats.
 */

export interface FieldTemplate {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'email' | 'phone' | 'address';
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  extractionHints?: string[]; // Keywords to help locate this field
  position?: {
    // Approximate position in document (0-1 scale)
    top?: number;
    left?: number;
    width?: number;
    height?: number;
  };
}

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: FieldTemplate[];
  ocrStrategy: 'highest_confidence' | 'majority_vote' | 'weighted_average' | 'all_engines';
  confidenceThreshold: number; // Minimum confidence for auto-approval (0-100)
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
  ocrSettings?: {
    strategy: string;
    confidenceThreshold: number;
  };
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'passport',
    name: 'Passport',
    category: 'Identity Documents',
    description: 'International passport with photo and personal details',
    ocrStrategy: 'weighted_average',
    confidenceThreshold: 95,
    icon: 'Plane',
    color: 'blue',
    fields: [
      {
        name: 'passport_number',
        label: 'Passport Number',
        type: 'text',
        required: true,
        validation: { pattern: '^[A-Z0-9]{6,9}$', minLength: 6, maxLength: 9 },
        extractionHints: ['passport no', 'passport number', 'document number'],
        position: { top: 0.6, left: 0.1, width: 0.4, height: 0.1 },
      },
      {
        name: 'surname',
        label: 'Surname',
        type: 'text',
        required: true,
        validation: { minLength: 1, maxLength: 100 },
        extractionHints: ['surname', 'last name', 'family name'],
        position: { top: 0.2, left: 0.1, width: 0.5, height: 0.08 },
      },
      {
        name: 'given_names',
        label: 'Given Names',
        type: 'text',
        required: true,
        validation: { minLength: 1, maxLength: 100 },
        extractionHints: ['given names', 'first name', 'forenames'],
        position: { top: 0.3, left: 0.1, width: 0.5, height: 0.08 },
      },
      {
        name: 'nationality',
        label: 'Nationality',
        type: 'text',
        required: true,
        extractionHints: ['nationality', 'citizen of'],
      },
      {
        name: 'date_of_birth',
        label: 'Date of Birth',
        type: 'date',
        required: true,
        extractionHints: ['date of birth', 'dob', 'birth date'],
      },
      {
        name: 'sex',
        label: 'Sex',
        type: 'text',
        required: true,
        validation: { pattern: '^(M|F|X)$' },
        extractionHints: ['sex', 'gender'],
      },
      {
        name: 'place_of_birth',
        label: 'Place of Birth',
        type: 'text',
        required: false,
        extractionHints: ['place of birth', 'birthplace'],
      },
      {
        name: 'date_of_issue',
        label: 'Date of Issue',
        type: 'date',
        required: true,
        extractionHints: ['date of issue', 'issued on', 'issue date'],
      },
      {
        name: 'date_of_expiry',
        label: 'Date of Expiry',
        type: 'date',
        required: true,
        extractionHints: ['date of expiry', 'expiry date', 'valid until'],
      },
      {
        name: 'issuing_authority',
        label: 'Issuing Authority',
        type: 'text',
        required: false,
        extractionHints: ['authority', 'issuing authority', 'issued by'],
      },
    ],
  },
  {
    id: 'drivers_license',
    name: "Driver's License",
    category: 'Identity Documents',
    description: "Driver's license with photo and driving privileges",
    ocrStrategy: 'weighted_average',
    confidenceThreshold: 92,
    icon: 'Car',
    color: 'green',
    fields: [
      {
        name: 'license_number',
        label: 'License Number',
        type: 'text',
        required: true,
        validation: { minLength: 5, maxLength: 20 },
        extractionHints: ['license number', 'dl number', 'driver license no'],
      },
      {
        name: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        validation: { minLength: 2, maxLength: 100 },
        extractionHints: ['name', 'full name', 'driver name'],
      },
      {
        name: 'date_of_birth',
        label: 'Date of Birth',
        type: 'date',
        required: true,
        extractionHints: ['dob', 'date of birth', 'birth date'],
      },
      {
        name: 'address',
        label: 'Address',
        type: 'address',
        required: true,
        extractionHints: ['address', 'residence', 'street address'],
      },
      {
        name: 'issue_date',
        label: 'Issue Date',
        type: 'date',
        required: true,
        extractionHints: ['iss', 'issue date', 'issued'],
      },
      {
        name: 'expiration_date',
        label: 'Expiration Date',
        type: 'date',
        required: true,
        extractionHints: ['exp', 'expiration', 'expires'],
      },
      {
        name: 'class',
        label: 'License Class',
        type: 'text',
        required: true,
        extractionHints: ['class', 'license class', 'type'],
      },
      {
        name: 'restrictions',
        label: 'Restrictions',
        type: 'text',
        required: false,
        extractionHints: ['restrictions', 'rest', 'endorsements'],
      },
    ],
  },
  {
    id: 'invoice',
    name: 'Invoice',
    category: 'Financial Documents',
    description: 'Commercial invoice with line items and totals',
    ocrStrategy: 'highest_confidence',
    confidenceThreshold: 88,
    icon: 'FileText',
    color: 'purple',
    fields: [
      {
        name: 'invoice_number',
        label: 'Invoice Number',
        type: 'text',
        required: true,
        validation: { minLength: 1, maxLength: 50 },
        extractionHints: ['invoice number', 'invoice no', 'inv no', '#'],
      },
      {
        name: 'invoice_date',
        label: 'Invoice Date',
        type: 'date',
        required: true,
        extractionHints: ['invoice date', 'date', 'issued'],
      },
      {
        name: 'due_date',
        label: 'Due Date',
        type: 'date',
        required: false,
        extractionHints: ['due date', 'payment due', 'due'],
      },
      {
        name: 'vendor_name',
        label: 'Vendor Name',
        type: 'text',
        required: true,
        extractionHints: ['from', 'vendor', 'seller', 'company name'],
      },
      {
        name: 'vendor_address',
        label: 'Vendor Address',
        type: 'address',
        required: false,
        extractionHints: ['address', 'vendor address'],
      },
      {
        name: 'customer_name',
        label: 'Customer Name',
        type: 'text',
        required: true,
        extractionHints: ['bill to', 'customer', 'buyer', 'to'],
      },
      {
        name: 'customer_address',
        label: 'Customer Address',
        type: 'address',
        required: false,
        extractionHints: ['billing address', 'customer address'],
      },
      {
        name: 'subtotal',
        label: 'Subtotal',
        type: 'currency',
        required: true,
        extractionHints: ['subtotal', 'sub total', 'amount before tax'],
      },
      {
        name: 'tax',
        label: 'Tax Amount',
        type: 'currency',
        required: false,
        extractionHints: ['tax', 'vat', 'gst', 'sales tax'],
      },
      {
        name: 'total',
        label: 'Total Amount',
        type: 'currency',
        required: true,
        extractionHints: ['total', 'amount due', 'total amount', 'grand total'],
      },
      {
        name: 'currency',
        label: 'Currency',
        type: 'text',
        required: false,
        validation: { pattern: '^[A-Z]{3}$' },
        extractionHints: ['currency', 'usd', 'eur', 'gbp', '$', '€', '£'],
      },
    ],
  },
  {
    id: 'receipt',
    name: 'Receipt',
    category: 'Financial Documents',
    description: 'Purchase receipt with items and payment details',
    ocrStrategy: 'majority_vote',
    confidenceThreshold: 85,
    icon: 'Receipt',
    color: 'orange',
    fields: [
      {
        name: 'merchant_name',
        label: 'Merchant Name',
        type: 'text',
        required: true,
        extractionHints: ['merchant', 'store', 'retailer'],
      },
      {
        name: 'merchant_address',
        label: 'Merchant Address',
        type: 'address',
        required: false,
        extractionHints: ['address', 'location'],
      },
      {
        name: 'receipt_number',
        label: 'Receipt Number',
        type: 'text',
        required: false,
        extractionHints: ['receipt', 'transaction', 'ref', 'reference'],
      },
      {
        name: 'date',
        label: 'Date',
        type: 'date',
        required: true,
        extractionHints: ['date', 'transaction date'],
      },
      {
        name: 'time',
        label: 'Time',
        type: 'text',
        required: false,
        extractionHints: ['time'],
      },
      {
        name: 'subtotal',
        label: 'Subtotal',
        type: 'currency',
        required: true,
        extractionHints: ['subtotal', 'sub total'],
      },
      {
        name: 'tax',
        label: 'Tax',
        type: 'currency',
        required: false,
        extractionHints: ['tax', 'vat', 'gst'],
      },
      {
        name: 'total',
        label: 'Total',
        type: 'currency',
        required: true,
        extractionHints: ['total', 'amount', 'grand total'],
      },
      {
        name: 'payment_method',
        label: 'Payment Method',
        type: 'text',
        required: false,
        extractionHints: ['payment', 'card', 'cash', 'credit', 'debit'],
      },
    ],
  },
  {
    id: 'contract',
    name: 'Contract',
    category: 'Legal Documents',
    description: 'Legal contract or agreement document',
    ocrStrategy: 'weighted_average',
    confidenceThreshold: 90,
    icon: 'FileSignature',
    color: 'red',
    fields: [
      {
        name: 'contract_title',
        label: 'Contract Title',
        type: 'text',
        required: true,
        extractionHints: ['agreement', 'contract', 'title'],
      },
      {
        name: 'contract_number',
        label: 'Contract Number',
        type: 'text',
        required: false,
        extractionHints: ['contract number', 'agreement number', 'ref'],
      },
      {
        name: 'effective_date',
        label: 'Effective Date',
        type: 'date',
        required: true,
        extractionHints: ['effective date', 'commencement date', 'start date'],
      },
      {
        name: 'expiration_date',
        label: 'Expiration Date',
        type: 'date',
        required: false,
        extractionHints: ['expiration', 'end date', 'termination date'],
      },
      {
        name: 'party_a_name',
        label: 'Party A Name',
        type: 'text',
        required: true,
        extractionHints: ['party a', 'first party', 'provider'],
      },
      {
        name: 'party_b_name',
        label: 'Party B Name',
        type: 'text',
        required: true,
        extractionHints: ['party b', 'second party', 'client'],
      },
      {
        name: 'contract_value',
        label: 'Contract Value',
        type: 'currency',
        required: false,
        extractionHints: ['value', 'amount', 'consideration', 'price'],
      },
      {
        name: 'governing_law',
        label: 'Governing Law',
        type: 'text',
        required: false,
        extractionHints: ['governing law', 'jurisdiction', 'applicable law'],
      },
    ],
  },
  {
    id: 'utility_bill',
    name: 'Utility Bill',
    category: 'Utility Documents',
    description: 'Electricity, water, gas, or internet bill',
    ocrStrategy: 'highest_confidence',
    confidenceThreshold: 87,
    icon: 'Zap',
    color: 'yellow',
    fields: [
      {
        name: 'account_number',
        label: 'Account Number',
        type: 'text',
        required: true,
        extractionHints: ['account', 'account number', 'customer number'],
      },
      {
        name: 'service_address',
        label: 'Service Address',
        type: 'address',
        required: true,
        extractionHints: ['service address', 'property address', 'location'],
      },
      {
        name: 'billing_period',
        label: 'Billing Period',
        type: 'text',
        required: true,
        extractionHints: ['billing period', 'service period', 'from', 'to'],
      },
      {
        name: 'bill_date',
        label: 'Bill Date',
        type: 'date',
        required: true,
        extractionHints: ['bill date', 'invoice date', 'date'],
      },
      {
        name: 'due_date',
        label: 'Due Date',
        type: 'date',
        required: true,
        extractionHints: ['due date', 'payment due', 'pay by'],
      },
      {
        name: 'previous_balance',
        label: 'Previous Balance',
        type: 'currency',
        required: false,
        extractionHints: ['previous balance', 'last balance', 'balance forward'],
      },
      {
        name: 'current_charges',
        label: 'Current Charges',
        type: 'currency',
        required: true,
        extractionHints: ['current charges', 'new charges', 'charges'],
      },
      {
        name: 'total_amount_due',
        label: 'Total Amount Due',
        type: 'currency',
        required: true,
        extractionHints: ['total', 'amount due', 'total amount', 'balance'],
      },
      {
        name: 'usage',
        label: 'Usage',
        type: 'text',
        required: false,
        extractionHints: ['usage', 'consumption', 'kwh', 'gallons', 'cubic meters'],
      },
    ],
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): DocumentTemplate | undefined {
  return DOCUMENT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): DocumentTemplate[] {
  return DOCUMENT_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get all unique categories
 */
export function getTemplateCategories(): string[] {
  return Array.from(new Set(DOCUMENT_TEMPLATES.map((t) => t.category)));
}

/**
 * Validate extracted data against template
 */
export function validateExtractedData(
  template: DocumentTemplate,
  data: Record<string, any>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of template.fields) {
    const value = data[field.name];

    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.name] = `${field.label} is required`;
      continue;
    }

    // Skip validation if field is empty and not required
    if (!value) continue;

    // Type-specific validation
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.name] = `${field.label} must be a valid email`;
    }

    if (field.type === 'phone' && !/^\+?[\d\s\-()]+$/.test(value)) {
      errors[field.name] = `${field.label} must be a valid phone number`;
    }

    // Pattern validation
    if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(value)) {
      errors[field.name] = `${field.label} format is invalid`;
    }

    // Length validation
    if (field.validation?.minLength && value.length < field.validation.minLength) {
      errors[field.name] = `${field.label} must be at least ${field.validation.minLength} characters`;
    }

    if (field.validation?.maxLength && value.length > field.validation.maxLength) {
      errors[field.name] = `${field.label} must be at most ${field.validation.maxLength} characters`;
    }

    // Numeric validation
    if (field.type === 'number' || field.type === 'currency') {
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numValue)) {
        errors[field.name] = `${field.label} must be a valid number`;
      } else {
        if (field.validation?.min !== undefined && numValue < field.validation.min) {
          errors[field.name] = `${field.label} must be at least ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && numValue > field.validation.max) {
          errors[field.name] = `${field.label} must be at most ${field.validation.max}`;
        }
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
