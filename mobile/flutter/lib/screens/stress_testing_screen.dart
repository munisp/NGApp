import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StressTestingScreen extends StatelessWidget {
  const StressTestingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Stress Testing',
      apiEndpoint: '/api/risk/v1/stress-tests',
      columnKeys: const ['id', 'scenario', 'impact', 'car', 'status'],
      columnLabels: const ['ID', 'Scenario', 'Impact', 'CAR After', 'Status'],
      seedData: const [
      {'id': 'STR-001', 'scenario': 'GDP -5%', 'impact': 'NGN 45B loss', 'car': '14.2%', 'status': 'Passed'},
    ],
    );
  }
}
