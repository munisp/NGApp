import { createContext, useContext, useState, useCallback, ReactNode, createElement } from 'react';
import en from './locales/en.json';
import fr from './locales/fr.json';

type Locale = 'en' | 'fr';
type TranslationMap = typeof en;

const translations: Record<Locale, TranslationMap> = { en, fr };

const SUPPORTED_LOCALES: { code: Locale; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  supportedLocales: typeof SUPPORTED_LOCALES;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('ps_locale');
  if (stored && stored in translations) return stored as Locale;
  const browserLang = navigator.language.split('-')[0];
  return browserLang in translations ? (browserLang as Locale) : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('ps_locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(
        translations[locale] as unknown as Record<string, unknown>,
        key
      );
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{{${k}}}`, String(v));
        }
      }
      return value;
    },
    [locale]
  );

  return createElement(
    I18nContext.Provider,
    { value: { locale, setLocale, t, supportedLocales: SUPPORTED_LOCALES } },
    children
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}

export { SUPPORTED_LOCALES };
export type { Locale };
