// ============================================================
// NEXCOM Exchange - Multi-Currency Support
// ============================================================

import { create } from "zustand";

export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR" | "KES" | "GHS" | "ZAR" | "XOF";

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string;
  locale: string;
  rate: number; // Exchange rate relative to USD (1 USD = X units)
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  NGN: { code: "NGN", name: "Nigerian Naira", symbol: "\u20A6", flag: "\uD83C\uDDF3\uD83C\uDDEC", locale: "en-NG", rate: 1550.0 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", flag: "\uD83C\uDDFA\uD83C\uDDF8", locale: "en-US", rate: 1.0 },
  GBP: { code: "GBP", name: "British Pound", symbol: "\u00A3", flag: "\uD83C\uDDEC\uD83C\uDDE7", locale: "en-GB", rate: 0.79 },
  EUR: { code: "EUR", name: "Euro", symbol: "\u20AC", flag: "\uD83C\uDDEA\uD83C\uDDFA", locale: "de-DE", rate: 0.92 },
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "\uD83C\uDDF0\uD83C\uDDEA", locale: "en-KE", rate: 153.5 },
  GHS: { code: "GHS", name: "Ghanaian Cedi", symbol: "GH\u20B5", flag: "\uD83C\uDDEC\uD83C\uDDED", locale: "en-GH", rate: 15.8 },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", flag: "\uD83C\uDDFF\uD83C\uDDE6", locale: "en-ZA", rate: 18.2 },
  XOF: { code: "XOF", name: "West African CFA", symbol: "CFA", flag: "\uD83C\uDDE8\uD83C\uDDEE", locale: "fr-CI", rate: 604.0 },
};

interface CurrencyState {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  convert: (usdAmount: number) => number;
  format: (usdAmount: number) => string;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  currency: "NGN",
  setCurrency: (code) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nexcom_currency", code);
    }
    set({ currency: code });
  },
  convert: (usdAmount: number) => {
    const { currency } = get();
    const info = CURRENCIES[currency];
    return usdAmount * info.rate;
  },
  format: (usdAmount: number) => {
    const { currency } = get();
    const info = CURRENCIES[currency];
    const converted = usdAmount * info.rate;
    return new Intl.NumberFormat(info.locale, {
      style: "currency",
      currency: info.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
  },
}));

// Initialize currency from localStorage
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("nexcom_currency") as CurrencyCode | null;
  if (saved && CURRENCIES[saved]) {
    useCurrencyStore.setState({ currency: saved });
  }
}
