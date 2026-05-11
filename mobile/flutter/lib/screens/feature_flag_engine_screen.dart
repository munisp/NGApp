import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FeatureFlagEngineScreen extends StatelessWidget {
  const FeatureFlagEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Feature Flags',
      apiEndpoint: '/api/feature-flags/v1/flags',
      columnKeys: const ['id', 'name', 'enabled', 'tenant', 'status'],
      columnLabels: const ['ID', 'Flag', 'Enabled', 'Tenant', 'Status'],
      seedData: const [
      {'id': 'FF-001', 'name': 'islamic_banking', 'enabled': 'true', 'tenant': 'TEN-JAIZ', 'status': 'Active'},
    ],
    );
  }
}
