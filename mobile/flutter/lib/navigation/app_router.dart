import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/server_config_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/wells/wells_screen.dart';
import '../screens/wells/well_detail_screen.dart';
import '../screens/alarms/alarms_screen.dart';
import '../screens/workovers/workovers_screen.dart';
import '../screens/financials/financials_screen.dart';
import '../screens/production/production_screen.dart';
import '../screens/permits/permits_screen.dart';
import '../screens/calibration/calibration_screen.dart';
import '../screens/hse/hse_screen.dart';
import '../screens/shifts/shift_handover_screen.dart';
import '../screens/damage/damage_assessment_screen.dart';
import '../screens/damage/damage_assessment_new_screen.dart';
import '../screens/materials/materials_screen.dart';
import '../screens/digitaltwin/digital_twin_screen.dart';
import '../screens/ai/ai_assistant_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../widgets/main_scaffold.dart';
import '../services/auth_service.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final isAuthenticated = authState.value?.isAuthenticated ?? false;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
          state.matchedLocation.startsWith('/server-config');

      if (!isAuthenticated && !isAuthRoute) return '/login';
      if (isAuthenticated && isAuthRoute) return '/dashboard';
      return null;
    },
    routes: [
      // Auth routes
      GoRoute(path: '/login', builder: (ctx, state) => const LoginScreen()),
      GoRoute(path: '/server-config', builder: (ctx, state) => const ServerConfigScreen()),

      // Main shell with bottom nav
      ShellRoute(
        builder: (ctx, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(path: '/dashboard', builder: (ctx, state) => const DashboardScreen()),
          GoRoute(
            path: '/wells',
            builder: (ctx, state) => const WellsScreen(),
            routes: [
              GoRoute(
                path: ':wellId',
                builder: (ctx, state) => WellDetailScreen(wellId: state.pathParameters['wellId']!),
              ),
            ],
          ),
          GoRoute(path: '/alarms', builder: (ctx, state) => const AlarmsScreen()),
          GoRoute(path: '/workovers', builder: (ctx, state) => const WorkoversScreen()),
          GoRoute(path: '/financials', builder: (ctx, state) => const FinancialsScreen()),
          GoRoute(path: '/production', builder: (ctx, state) => const ProductionScreen()),
          GoRoute(path: '/permits', builder: (ctx, state) => const PermitsScreen()),
          GoRoute(path: '/calibration', builder: (ctx, state) => const CalibrationScreen()),
          GoRoute(path: '/hse', builder: (ctx, state) => const HSEScreen()),
          GoRoute(path: '/shift-handover', builder: (ctx, state) => const ShiftHandoverScreen()),
          GoRoute(
            path: '/damage-assessment',
            builder: (ctx, state) => const DamageAssessmentScreen(),
            routes: [
              GoRoute(path: 'new', builder: (ctx, state) => const DamageAssessmentNewScreen()),
            ],
          ),
          GoRoute(path: '/materials', builder: (ctx, state) => const MaterialsScreen()),
          GoRoute(path: '/digital-twin', builder: (ctx, state) => const DigitalTwinScreen()),
          GoRoute(path: '/ai-assistant', builder: (ctx, state) => const AIAssistantScreen()),
          GoRoute(path: '/settings', builder: (ctx, state) => const SettingsScreen()),
        ],
      ),
    ],
  );
});
