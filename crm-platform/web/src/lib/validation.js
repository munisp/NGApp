/**
 * Client-side validation utilities
 * Mirrors Go-side validation rules for consistency
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/
const HTML_TAG_REGEX = /<[^>]*>/g

export const sanitize = (value) => {
  if (typeof value !== 'string') return value
  return value.trim().replace(HTML_TAG_REGEX, '')
}

export const validators = {
  required: (value, fieldName = 'Field') => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`
    }
    return null
  },

  email: (value) => {
    if (!value) return null
    if (!EMAIL_REGEX.test(value)) return 'Invalid email address'
    return null
  },

  phone: (value) => {
    if (!value) return null
    if (!PHONE_REGEX.test(value)) return 'Invalid phone number'
    return null
  },

  maxLength: (value, max, fieldName = 'Field') => {
    if (!value) return null
    if (value.length > max) return `${fieldName} must be ${max} characters or less`
    return null
  },

  minLength: (value, min, fieldName = 'Field') => {
    if (!value) return null
    if (value.length < min) return `${fieldName} must be at least ${min} characters`
    return null
  },

  oneOf: (value, options, fieldName = 'Field') => {
    if (!value) return null
    if (!options.includes(value)) return `${fieldName} must be one of: ${options.join(', ')}`
    return null
  },

  nonNegative: (value, fieldName = 'Value') => {
    if (value === undefined || value === null) return null
    if (Number(value) < 0) return `${fieldName} must be non-negative`
    return null
  },

  bvn: (value) => {
    if (!value) return null
    if (!/^\d{11}$/.test(value)) return 'BVN must be 11 digits'
    return null
  },

  nin: (value) => {
    if (!value) return null
    if (!/^\d{11}$/.test(value)) return 'NIN must be 11 digits'
    return null
  },

  currency: (value) => {
    if (!value) return null
    if (!/^[A-Z]{3}$/.test(value)) return 'Currency must be 3-letter ISO code'
    return null
  },
}

export const validateForm = (data, rules) => {
  const errors = {}
  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const error = rule(data[field])
      if (error) {
        errors[field] = error
        break
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export const customerValidationRules = {
  first_name: [
    (v) => validators.required(v, 'First name'),
    (v) => validators.maxLength(v, 100, 'First name'),
  ],
  last_name: [
    (v) => validators.required(v, 'Last name'),
    (v) => validators.maxLength(v, 100, 'Last name'),
  ],
  email: [
    (v) => validators.email(v),
  ],
  phone: [
    (v) => validators.phone(v),
  ],
  segment: [
    (v) => validators.oneOf(v, ['vip', 'premium', 'standard', 'basic', 'dormant'], 'Segment'),
  ],
}

export const campaignValidationRules = {
  name: [
    (v) => validators.required(v, 'Campaign name'),
    (v) => validators.maxLength(v, 255, 'Campaign name'),
  ],
  type: [
    (v) => validators.oneOf(v, ['email', 'sms', 'push', 'whatsapp', 'in_app', 'multi_channel'], 'Type'),
  ],
  budget_amount: [
    (v) => validators.nonNegative(v, 'Budget'),
  ],
}
