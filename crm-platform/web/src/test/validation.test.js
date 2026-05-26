import { describe, it, expect } from 'vitest'
import { validators, validateForm, sanitize, customerValidationRules } from '@/lib/validation'

describe('Validators', () => {
  describe('required', () => {
    it('returns error for empty string', () => {
      expect(validators.required('', 'Name')).toBe('Name is required')
    })
    it('returns error for null', () => {
      expect(validators.required(null, 'Name')).toBe('Name is required')
    })
    it('returns null for valid input', () => {
      expect(validators.required('John')).toBeNull()
    })
  })

  describe('email', () => {
    it('validates correct email', () => {
      expect(validators.email('user@example.com')).toBeNull()
    })
    it('rejects invalid email', () => {
      expect(validators.email('not-an-email')).toBe('Invalid email address')
    })
    it('allows empty (optional)', () => {
      expect(validators.email('')).toBeNull()
    })
  })

  describe('phone', () => {
    it('validates Nigerian phone', () => {
      expect(validators.phone('+234 801 234 5678')).toBeNull()
    })
    it('rejects invalid phone', () => {
      expect(validators.phone('abc')).toBe('Invalid phone number')
    })
  })

  describe('bvn', () => {
    it('validates 11-digit BVN', () => {
      expect(validators.bvn('12345678901')).toBeNull()
    })
    it('rejects non-11-digit', () => {
      expect(validators.bvn('1234')).toBe('BVN must be 11 digits')
    })
  })

  describe('nin', () => {
    it('validates 11-digit NIN', () => {
      expect(validators.nin('98765432109')).toBeNull()
    })
  })

  describe('currency', () => {
    it('validates ISO currency code', () => {
      expect(validators.currency('NGN')).toBeNull()
      expect(validators.currency('USD')).toBeNull()
    })
    it('rejects invalid', () => {
      expect(validators.currency('ng')).toBe('Currency must be 3-letter ISO code')
    })
  })

  describe('maxLength', () => {
    it('passes within limit', () => {
      expect(validators.maxLength('abc', 5)).toBeNull()
    })
    it('fails over limit', () => {
      expect(validators.maxLength('abcdef', 3, 'Name')).toBe('Name must be 3 characters or less')
    })
  })

  describe('oneOf', () => {
    it('passes for valid option', () => {
      expect(validators.oneOf('vip', ['vip', 'premium', 'standard'])).toBeNull()
    })
    it('fails for invalid option', () => {
      expect(validators.oneOf('gold', ['vip', 'premium'], 'Segment')).toBe('Segment must be one of: vip, premium')
    })
  })
})

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>hello')).toBe('alert("xss")hello')
  })
  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello')
  })
  it('passes non-strings through', () => {
    expect(sanitize(42)).toBe(42)
  })
})

describe('validateForm', () => {
  it('validates a complete customer form', () => {
    const data = {
      first_name: 'Adamu',
      last_name: 'Ibrahim',
      email: 'adamu@bank.ng',
      phone: '+234 801 234 5678',
      segment: 'vip',
    }
    const result = validateForm(data, customerValidationRules)
    expect(result.valid).toBe(true)
    expect(Object.keys(result.errors)).toHaveLength(0)
  })

  it('returns errors for invalid customer', () => {
    const data = {
      first_name: '',
      last_name: 'I',
      email: 'not-email',
      segment: 'gold',
    }
    const result = validateForm(data, customerValidationRules)
    expect(result.valid).toBe(false)
    expect(result.errors.first_name).toBe('First name is required')
    expect(result.errors.email).toBe('Invalid email address')
    expect(result.errors.segment).toContain('must be one of')
  })
})
