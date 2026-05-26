import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../utils/theme.dart';

class MainScaffold extends StatelessWidget {
  final Widget child;
  const MainScaffold({super.key, required this.child});

  static const _navItems = [
    (icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, label: 'Dashboard', path: '/dashboard'),
    (icon: Icons.oil_barrel_outlined, activeIcon: Icons.oil_barrel, label: 'Wells', path: '/wells'),
    (icon: Icons.notifications_outlined, activeIcon: Icons.notifications, label: 'Alarms', path: '/alarms'),
    (icon: Icons.build_outlined, activeIcon: Icons.build, label: 'Workovers', path: '/workovers'),
    (icon: Icons.more_horiz, activeIcon: Icons.more_horiz, label: 'More', path: '/settings'),
  ];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    for (var i = 0; i < _navItems.length; i++) {
      if (location.startsWith(_navItems[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _currentIndex(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: (i) => context.go(_navItems[i].path),
        items: _navItems.map((item) => BottomNavigationBarItem(
          icon: Icon(item.icon),
          activeIcon: Icon(item.activeIcon),
          label: item.label,
        )).toList(),
      ),
    );
  }
}
