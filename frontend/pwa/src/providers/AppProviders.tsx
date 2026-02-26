"use client";

import { useEffect, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastContainer } from "@/components/common/Toast";
import { useThemeStore } from "@/components/common/ThemeToggle";
import { useAuthStore } from "@/lib/auth";
import { usePriceSimulation } from "@/hooks/useWebSocket";

// ============================================================
// App Providers - wraps the entire application
// ============================================================

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeInitializer />
      <AuthInitializer />
      <PriceSimulationProvider />
      {children}
      <ToastContainer />
    </ErrorBoundary>
  );
}

// Initialize theme from localStorage
function ThemeInitializer() {
  const { setTheme } = useThemeStore();

  useEffect(() => {
    const saved = localStorage.getItem("nexcom_theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }, [setTheme]);

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
