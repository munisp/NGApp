import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { translations, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './translations'

const I18nContext = createContext()

export const useTranslation = () => {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useTranslation must be used within I18nProvider')
  return context
}

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    const saved = localStorage.getItem('locale')
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved
    const browserLang = navigator.language?.split('-')[0]
    if (SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang
    return DEFAULT_LANGUAGE
  })

  const changeLocale = useCallback((newLocale) => {
    if (SUPPORTED_LANGUAGES.includes(newLocale)) {
      setLocale(newLocale)
      localStorage.setItem('locale', newLocale)
      document.documentElement.lang = newLocale
      document.documentElement.dir = translations[newLocale]?.dir || 'ltr'
    }
  }, [])

  const t = useCallback((key, fallback) => {
    const value = getNestedValue(translations[locale], key)
    if (value) return value
    const enValue = getNestedValue(translations[DEFAULT_LANGUAGE], key)
    return enValue || fallback || key
  }, [locale])

  const value = useMemo(() => ({
    locale,
    changeLocale,
    t,
    languages: SUPPORTED_LANGUAGES.map(code => ({
      code,
      name: translations[code].lang,
    })),
  }), [locale, changeLocale, t])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export default useTranslation
