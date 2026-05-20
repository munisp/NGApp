import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AuthEnforcerScreen extends StatelessWidget {
  const AuthEnforcerScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Auth Enforcer',
      apiEndpoint: '/api/production/auth-enforcer/policies',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'AUTH_ENFORCER_SCREEN-001', 'status': 'active'},
        {'id': 'AUTH_ENFORCER_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
