import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DisasterRecoveryScreen extends StatelessWidget {
  const DisasterRecoveryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Disaster Recovery',
      apiEndpoint: '/api/dr/v1/replicas',
      columnKeys: const ['id', 'region', 'role', 'lag', 'status'],
      columnLabels: const ['ID', 'Region', 'Role', 'Lag', 'Status'],
      seedData: const [
      {'id': 'DR-001', 'region': 'Lagos', 'role': 'Primary', 'lag': '0', 'status': 'Online'},
      {'id': 'DR-002', 'region': 'Abuja', 'role': 'Standby', 'lag': '0.2s', 'status': 'Streaming'},
    ],
    );
  }
}
