"use client";

import { useEffect, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastContainer } from "@/components/common/Toast";
import { useThemeStore, type ThemeMode } from "@/components/common/ThemeToggle";
import { useAuthStore } from "@/lib/auth";
import { usePriceSimulation } from "@/hooks/useWebSocket";
import { useCurrencyStore, CURRENCIES, type CurrencyCode } from "@/lib/currency";

// ============================================================
// App Providers - wraps the entire application
// ============================================================

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeInitializer />
      <CurrencyInitializer />
      <AuthInitializer />
      <PriceSimulationProvider />
      {children}
      <ToastContainer />
    </ErrorBoundary>
  );
}

// Initialize theme from localStorage (supports dark, light, system)
function ThemeInitializer() {
  const { setTheme } = useThemeStore();

  useEffect(() => {
    const saved = localStorage.getItem("nexcom_theme") as ThemeMode | null;
    if (saved && ["dark", "light", "system"].includes(saved)) {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }, [setTheme]);

  return null;
}

// Initialize currency from localStorage (default: NGN)
function CurrencyInitializer() {
  const { setCurrency } = useCurrencyStore();

  useEffect(() => {
    const saved = localStorage.getItem("nexcom_currency") as CurrencyCode | null;
    if (saved && CURRENCIES[saved]) {
      setCurrency(saved);
    }
  }, [setCurrency]);

  return null;
}

// Initialize auth state from persisted tokens
function AuthInitializer() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) {
      checkAuth();
    }
  }, [checkAuth, isLoading]);

  return null;
}

// Start price simulation for demo mode
function PriceSimulationProvider() {
  usePriceSimulation(true);
  return null;
}
