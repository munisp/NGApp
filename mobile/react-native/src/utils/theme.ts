/**
 * OG-RMM Mobile Theme — Dark industrial palette matching the PWA.
 * All colors use the same design tokens as the web app's CSS variables.
 */
export const COLORS = {
  // Backgrounds
  background: "#0a0f1a",
  surface: "#111827",
  surfaceElevated: "#1f2937",
  border: "#374151",

  // Text
  text: "#f9fafb",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",

  // Brand
  primary: "#f97316",       // Amber-orange — matches PWA accent
  primaryDark: "#ea580c",
  primaryLight: "#fb923c",

  // Status
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  info: "#3b82f6",

  // Alarm severities (ISA-18.2)
  alarmCritical: "#ef4444",
  alarmHigh: "#f97316",
  alarmMedium: "#eab308",
  alarmLow: "#3b82f6",
  alarmInfo: "#6b7280",

  // Well status
  wellProducing: "#22c55e",
  wellShutIn: "#eab308",
  wellWorkover: "#f97316",
  wellAbandoned: "#6b7280",
  wellInjector: "#3b82f6",
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const SHADOW = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
} as const;
