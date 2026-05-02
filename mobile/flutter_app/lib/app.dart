import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'screens/home_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/remittance_screen.dart';
import 'screens/disputes_screen.dart';
import 'screens/recurring_screen.dart';
import 'screens/batch_transfer_screen.dart';
import 'screens/support_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/compliance_screen.dart';
import 'screens/security_screen.dart';
import 'screens/referral_screen.dart';
import 'screens/limits_screen.dart';
import 'screens/fees_screen.dart';
import 'screens/audit_log_screen.dart';
import 'screens/login_screen.dart';

final GoRouter _router = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    ShellRoute(
      builder: (_, __, child) => MainShell(child: child),
      routes: [
        GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
        GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
        GoRoute(path: '/remittance', builder: (_, __) => const RemittanceScreen()),
        GoRoute(path: '/disputes', builder: (_, __) => const DisputesScreen()),
        GoRoute(path: '/recurring', builder: (_, __) => const RecurringScreen()),
        GoRoute(path: '/batch', builder: (_, __) => const BatchTransferScreen()),
        GoRoute(path: '/support', builder: (_, __) => const SupportScreen()),
        GoRoute(path: '/compliance', builder: (_, __) => const ComplianceScreen()),
        GoRoute(path: '/security', builder: (_, __) => const SecurityScreen()),
        GoRoute(path: '/referrals', builder: (_, __) => const ReferralScreen()),
        GoRoute(path: '/limits', builder: (_, __) => const LimitsScreen()),
        GoRoute(path: '/fees', builder: (_, __) => const FeesScreen()),
        GoRoute(path: '/audit-log', builder: (_, __) => const AuditLogScreen()),
        GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      ],
    ),
  ],
);

class PaymentSwitchApp extends StatelessWidget {
  const PaymentSwitchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Payment Switch',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1A73E8),
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF1A73E8),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      routerConfig: _router,
    );
  }
}

class MainShell extends StatelessWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _getSelectedIndex(GoRouterState.of(context).uri.toString()),
        onDestinationSelected: (index) => _onItemTapped(context, index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.send), label: 'Send'),
          NavigationDestination(icon: Icon(Icons.support_agent), label: 'Support'),
          NavigationDestination(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }

  int _getSelectedIndex(String location) {
    if (location.startsWith('/dashboard')) return 1;
    if (location.startsWith('/remittance')) return 2;
    if (location.startsWith('/support')) return 3;
    if (location.startsWith('/settings')) return 4;
    return 0;
  }

  void _onItemTapped(BuildContext context, int index) {
    switch (index) {
      case 0: context.go('/'); break;
      case 1: context.go('/dashboard'); break;
      case 2: context.go('/remittance'); break;
      case 3: context.go('/support'); break;
      case 4: context.go('/settings'); break;
    }
  }
}
