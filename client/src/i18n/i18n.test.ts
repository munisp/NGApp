import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';

describe('i18n', () => {
  it('English and French have same keys', () => {
    const enKeys = Object.keys(en);
    const frKeys = Object.keys(fr);
    expect(enKeys).toEqual(frKeys);
  });

  it('all translation categories exist in both locales', () => {
    const categories = ['common', 'auth', 'nav', 'payments', 'remittance', 'compliance', 'errors'];
    for (const cat of categories) {
      expect(en).toHaveProperty(cat);
      expect(fr).toHaveProperty(cat);
    }
  });

  it('all nested keys match between locales', () => {
    for (const [category, values] of Object.entries(en)) {
      const frCategory = (fr as Record<string, Record<string, string>>)[category];
      expect(frCategory).toBeDefined();
      for (const key of Object.keys(values as Record<string, string>)) {
        expect(frCategory).toHaveProperty(key);
      }
    }
  });

  it('no empty translations', () => {
    for (const [, values] of Object.entries(en)) {
      for (const [key, value] of Object.entries(values as Record<string, string>)) {
        expect(value.length, `en.${key} is empty`).toBeGreaterThan(0);
      }
    }
    for (const [, values] of Object.entries(fr)) {
      for (const [key, value] of Object.entries(values as Record<string, string>)) {
        expect(value.length, `fr.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });
});
