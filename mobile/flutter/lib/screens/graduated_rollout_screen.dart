import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GraduatedRolloutScreen extends StatelessWidget {
  const GraduatedRolloutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Graduated Rollout',
      apiEndpoint: '/api/rollout/v1/features',
      columnKeys: const ['id', 'feature', 'stage', 'percentage', 'status'],
      columnLabels: const ['ID', 'Feature', 'Stage', 'Rollout %', 'Status'],
      seedData: const [
      {'id': 'GR-001', 'feature': 'New Dashboard', 'stage': 'Canary', 'percentage': '5%', 'status': 'Active'},
    ],
    );
  }
}
