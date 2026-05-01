/**
 * ThemeContext — dark/light theme with backend persistence.
 *
 * Priority order for initial theme:
 *   1. Backend preference (themePrefs.get) — cross-device
 *   2. localStorage — offline fallback
 *   3. defaultTheme prop
 *
 * On every toggle the new value is:
 *   - Written to localStorage immediately (instant feedback)
 *   - Persisted to the backend via trpc.themePrefs.set (debounced 500ms)
 */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
  isSyncing: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Backend preference fetch (runs once on mount when switchable) ──────────
  const { data: backendPrefs } = trpc.themePrefs.get.useQuery(undefined, {
    enabled: switchable,
    staleTime: Infinity,
    retry: false,
  });

  // When backend prefs arrive, override localStorage/default if different
  useEffect(() => {
    if (!switchable || !backendPrefs) return;
    const backendTheme = backendPrefs.theme as Theme;
    if (backendTheme && backendTheme !== theme) {
      setTheme(backendTheme);
      localStorage.setItem("theme", backendTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendPrefs]);

  // ── Apply theme class to <html> ────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  // ── Backend sync mutation ──────────────────────────────────────────────────
  const setThemeMutation = trpc.themePrefs.set.useMutation({
    onSettled: () => setIsSyncing(false),
  });

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => {
          const next: Theme = prev === "light" ? "dark" : "light";
          // Debounce backend sync by 500ms to avoid hammering on rapid clicks
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          setIsSyncing(true);
          syncTimerRef.current = setTimeout(() => {
            setThemeMutation.mutate({ theme: next });
          }, 500);
          return next;
        });
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable, isSyncing }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
