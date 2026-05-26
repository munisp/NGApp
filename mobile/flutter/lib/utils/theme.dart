import 'package:flutter/material.dart';

/// OG-RMM dark industrial theme — matches the PWA's CSS variables.
class OGRMMTheme {
  // Brand colors
  static const Color primary = Color(0xFFF97316);       // Amber-orange
  static const Color primaryDark = Color(0xFFEA580C);
  static const Color primaryLight = Color(0xFFFB923C);

  // Backgrounds
  static const Color background = Color(0xFF0A0F1A);
  static const Color surface = Color(0xFF111827);
  static const Color surfaceElevated = Color(0xFF1F2937);
  static const Color border = Color(0xFF374151);

  // Text
  static const Color textPrimary = Color(0xFFF9FAFB);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);

  // Status
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFEAB308);
  static const Color error = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);

  // Alarm severities (ISA-18.2)
  static const Color alarmCritical = Color(0xFFEF4444);
  static const Color alarmHigh = Color(0xFFF97316);
  static const Color alarmMedium = Color(0xFFEAB308);
  static const Color alarmLow = Color(0xFF3B82F6);

  // Well status
  static const Color wellProducing = Color(0xFF22C55E);
  static const Color wellShutIn = Color(0xFFEAB308);
  static const Color wellWorkover = Color(0xFFF97316);
  static const Color wellAbandoned = Color(0xFF6B7280);
  static const Color wellInjector = Color(0xFF3B82F6);

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        onPrimary: Colors.white,
        secondary: primaryLight,
        onSecondary: Colors.white,
        surface: surface,
        onSurface: textPrimary,
        error: error,
        onError: Colors.white,
      ),
      scaffoldBackgroundColor: background,
      cardTheme: const CardTheme(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: primary,
        unselectedItemColor: textSecondary,
        type: BottomNavigationBarType.fixed,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: background,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: primary),
        ),
        hintStyle: const TextStyle(color: textMuted),
        labelStyle: const TextStyle(color: textSecondary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        ),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w800),
        headlineMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
        headlineSmall: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
        titleLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
        titleMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.w500),
        titleSmall: TextStyle(color: textSecondary),
        bodyLarge: TextStyle(color: textPrimary),
        bodyMedium: TextStyle(color: textPrimary),
        bodySmall: TextStyle(color: textSecondary),
        labelLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
        labelMedium: TextStyle(color: textSecondary),
        labelSmall: TextStyle(color: textMuted),
      ),
    );
  }
}
