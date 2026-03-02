"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { Sun, Moon, Monitor } from "lucide-react";

// ============================================================
// Theme Store — supports dark, light, and system (auto) modes
// ============================================================

export type ThemeMode = "dark" | "light" | "system";

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: "dark" | "light") {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("light", resolved === "light");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nexcom_theme", theme);
    }
    const resolved = theme === "system" ? getSystemTheme() : theme;
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
  },
  toggleTheme: () => {
    const order: ThemeMode[] = ["dark", "light", "system"];
    const idx = order.indexOf(get().theme);
    const next = order[(idx + 1) % order.length];
    get().setTheme(next);
  },
}));

// Listen for OS preference changes when in system mode
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") {
      const resolved = getSystemTheme();
      applyTheme(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
}

// ============================================================
// Theme Toggle Button
// ============================================================

const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-all duration-200"
      aria-label={`Theme: ${THEME_LABELS[theme]}. Click to switch.`}
      title={`Theme: ${THEME_LABELS[theme]}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-medium hidden sm:inline">{THEME_LABELS[theme]}</span>
    </button>
  );
}
