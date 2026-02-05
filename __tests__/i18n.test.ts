import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../lib/i18n';

describe('i18n Configuration', () => {
  beforeEach(async () => {
    // Reset to English before each test
    await i18n.changeLanguage('en');
  });

  it('should initialize with correct default language', () => {
    expect(i18n.language).toBeDefined();
    expect(['en', 'fr', 'sw', 'ha', 'yo', 'ig']).toContain(i18n.language);
  });

  it('should have all 6 African languages available', () => {
    const languages = Object.keys(i18n.options.resources || {});
    expect(languages).toContain('en');
    expect(languages).toContain('fr');
    expect(languages).toContain('sw');
    expect(languages).toContain('ha');
    expect(languages).toContain('yo');
    expect(languages).toContain('ig');
    expect(languages.length).toBe(6);
  });

  it('should translate common.welcome in English', () => {
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Welcome');
  });

  it('should translate common.welcome in French', async () => {
    await i18n.changeLanguage('fr');
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Bienvenue');
  });

  it('should translate common.welcome in Swahili', async () => {
    await i18n.changeLanguage('sw');
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Karibu');
  });

  it('should translate common.welcome in Hausa', async () => {
    await i18n.changeLanguage('ha');
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Barka da zuwa');
  });

  it('should translate common.welcome in Yoruba', async () => {
    await i18n.changeLanguage('yo');
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Ẹ káàbọ̀');
  });

  it('should translate common.welcome in Igbo', async () => {
    await i18n.changeLanguage('ig');
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Nnọọ');
  });

  it('should translate home.title in all languages', async () => {
    const translations = {
      en: 'African Fintech',
      fr: 'Fintech Africaine',
      sw: 'Fedha ya Afrika',
      ha: 'Fintech na Afirka',
      yo: 'Fintech ti Áfríkà',
      ig: 'Fintech nke Africa',
    };

    for (const [lang, expected] of Object.entries(translations)) {
      await i18n.changeLanguage(lang);
      const translation = i18n.t('home.title');
      expect(translation).toBe(expected);
    }
  });

  it('should fallback to English for missing keys', async () => {
    await i18n.changeLanguage('fr');
    const translation = i18n.t('nonexistent.key');
    expect(translation).toBe('nonexistent.key'); // i18next returns the key if not found
  });

  it('should change language dynamically', async () => {
    expect(i18n.language).toBe('en');
    
    await i18n.changeLanguage('fr');
    expect(i18n.language).toBe('fr');
    
    await i18n.changeLanguage('sw');
    expect(i18n.language).toBe('sw');
  });

  it('should have correct common translations structure', () => {
    const commonKeys = ['welcome', 'continue', 'cancel', 'save', 'loading', 'error', 'success'];
    
    commonKeys.forEach(key => {
      const translation = i18n.t(`common.${key}`);
      expect(translation).toBeDefined();
      expect(translation).not.toBe(`common.${key}`);
    });
  });
});
