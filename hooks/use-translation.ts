import { useTranslation as useI18nextTranslation } from 'react-i18next';

/**
 * Custom hook wrapper for react-i18next useTranslation
 * Provides type-safe translation function and language switching
 */
export function useTranslation() {
  return useI18nextTranslation();
}
