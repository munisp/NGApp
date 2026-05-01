/// NDSEP Flutter — Entry Point
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'screens/dashboard/dashboard_screen.dart';
import 'screens/compliance/compliance_screen.dart';
import 'screens/enforcement/enforcement_screen.dart';
import 'screens/siem/security_alerts_screen.dart';
import 'screens/assets/asset_registry_screen.dart';
import 'screens/portal/portal_screen.dart';
import 'screens/compliance/citizen_rights_screen.dart';
import 'screens/dashboard/organizations_screen.dart';
import 'screens/dashboard/organization_detail_screen.dart';
import 'screens/enforcement/penalty_detail_screen.dart';
import 'screens/audit/audit_log_screen.dart';
import 'screens/dashboard/notifications_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/compliance/leaderboard_screen.dart';
import 'screens/enforcement/remediation_workflows_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const storage = FlutterSecureStorage();
  final token = await storage.read(key: 'ndsep_session_token');
  runApp(ProviderScope(child: NdsepApp(isAuthenticated: token != null)));
}

class NdsepApp extends StatelessWidget {
  final bool isAuthenticated;
  const NdsepApp({super.key, required this.isAuthenticated});

  @override
  Widget build(BuildContext context) {
    final router = GoRouter(
      initialLocation: isAuthenticated ? '/' : '/login',
      routes: [
        ShellRoute(
          builder: (context, state, child) => AppShell(child: child),
          routes: [
            GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
            GoRoute(path: '/compliance', builder: (_, __) => const ComplianceScreen()),
            GoRoute(path: '/enforcement', builder: (_, __) => const EnforcementScreen()),
            GoRoute(path: '/alerts', builder: (_, __) => const SecurityAlertsScreen()),
            GoRoute(path: '/organizations', builder: (_, __) => const OrganizationsScreen()),
            GoRoute(path: '/organizations/:id', builder: (_, state) => OrganizationDetailScreen(orgId: int.parse(state.pathParameters['id']!))),
            GoRoute(path: '/assets', builder: (_, __) => const AssetRegistryScreen()),
            GoRoute(path: '/citizen-rights', builder: (_, __) => const CitizenRightsScreen()),
            GoRoute(path: '/portal', builder: (_, __) => const PortalScreen()),
            GoRoute(path: '/audit', builder: (_, __) => const AuditLogScreen()),
            GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
            GoRoute(path: '/penalties/:id', builder: (_, state) => PenaltyDetailScreen(penaltyId: int.parse(state.pathParameters['id']!))),
            GoRoute(path: '/leaderboard', builder: (_, __) => const ComplianceLeaderboardScreen()),
            GoRoute(path: '/remediation', builder: (_, __) => const RemediationWorkflowsScreen()),
          ],
        ),
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ],
    );

    return MaterialApp.router(
      title: 'NDSEP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00D4FF),
          brightness: Brightness.dark,
          surface: const Color(0xFF0A0E1A),
          primary: const Color(0xFF00D4FF),
        ),
        scaffoldBackgroundColor: const Color(0xFF0A0E1A),
        cardColor: const Color(0xFF0F172A),
        useMaterial3: true,
        fontFamily: 'Inter',
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0A0E1A),
          foregroundColor: Color(0xFFF1F5F9),
          elevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
        drawerTheme: const DrawerThemeData(
          backgroundColor: Color(0xFF0A0E1A),
          surfaceTintColor: Colors.transparent,
        ),
        navigationBarTheme: const NavigationBarThemeData(
          backgroundColor: Color(0xFF0A0E1A),
          indicatorColor: Color(0xFF00D4FF20),
        ),
      ),
      routerConfig: router,
    );
  }
}

/// App shell with drawer navigation
class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      body: child,
    );
  }
}

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();

    Widget navItem(String label, String path, IconData icon) {
      final isActive = location == path || (path != '/' && location.startsWith(path));
      return ListTile(
        leading: Icon(icon, color: isActive ? const Color(0xFF00D4FF) : const Color(0xFF64748B), size: 20),
        title: Text(label, style: TextStyle(
          color: isActive ? const Color(0xFF00D4FF) : const Color(0xFF94A3B8),
          fontSize: 14, fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
        )),
        tileColor: isActive ? const Color(0xFF00D4FF08) : Colors.transparent,
        onTap: () { Navigator.pop(context); context.go(path); },
      );
    }

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(children: [
                Container(
                  width: 40, height: 40, decoration: BoxDecoration(
                    color: const Color(0xFF00D4FF20), borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF00D4FF50)),
                  ),
                  child: const Center(child: Text('NG', style: TextStyle(color: Color(0xFF00D4FF), fontWeight: FontWeight.w900, fontSize: 14))),
                ),
                const SizedBox(width: 12),
                const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('NDSEP', style: TextStyle(color: Color(0xFFF1F5F9), fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 2)),
                  Text('Enforcement Platform', style: TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                ]),
              ]),
            ),
            const Divider(color: Color(0xFF1E293B)),
            Expanded(child: ListView(padding: EdgeInsets.zero, children: [
              navItem('Dashboard', '/', Icons.dashboard_outlined),
              navItem('Compliance', '/compliance', Icons.verified_outlined),
              navItem('Enforcement', '/enforcement', Icons.gavel_outlined),
              navItem('Security Alerts', '/alerts', Icons.security_outlined),
              navItem('Organizations', '/organizations', Icons.business_outlined),
              navItem('Asset Registry', '/assets', Icons.storage_outlined),
              navItem('Citizen Rights', '/citizen-rights', Icons.people_outlined),
              navItem('Portal', '/portal', Icons.web_outlined),
              navItem('Audit Log', '/audit', Icons.history_outlined),
              navItem('Notifications', '/notifications', Icons.notifications_outlined),
              navItem('Leaderboard', '/leaderboard', Icons.leaderboard_outlined),
              navItem('Remediation', '/remediation', Icons.build_circle_outlined),
            ])),
          ],
        ),
      ),
    );
  }
}
