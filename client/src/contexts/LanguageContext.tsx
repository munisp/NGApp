import React, { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SupportedLanguage } from "@/lib/i18n";

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  isRTL: boolean;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  isRTL: false,
  dir: "ltr",
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<SupportedLanguage>(
    (localStorage.getItem("og-rmm-lang") as SupportedLanguage) || "en"
  );

  const isRTL = language === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("og-rmm-lang", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle("rtl", lang === "ar");
  };

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.classList.toggle("rtl", isRTL);
    i18n.changeLanguage(language);
  }, [language, isRTL, i18n]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
