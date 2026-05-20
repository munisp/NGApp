import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class JwtAuthScreen extends StatelessWidget {
  const JwtAuthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'JWT Auth',
      apiEndpoint: '/api/auth/v1/sessions',
      columnKeys: const ['session', 'email', 'tenant', 'status'],
      columnLabels: const ['Session', 'Email', 'Tenant', 'Status'],
      seedData: const [
      {'session': 'SES-001', 'email': 'admin@54bank.app', 'tenant': 'TEN-PLATFORM', 'status': 'Active'},
    ],
    );
  }
}
