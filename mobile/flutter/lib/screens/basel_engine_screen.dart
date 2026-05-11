import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BaselEngineScreen extends StatelessWidget {
  const BaselEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Basel Engine',
      apiEndpoint: '/api/basel/v1/ratios',
      columnKeys: const ['metric', 'value', 'requirement', 'status'],
      columnLabels: const ['Metric', 'Value', 'Requirement', 'Status'],
      seedData: const [
      {'metric': 'CAR', 'value': '16.8%', 'requirement': '15%', 'status': 'Compliant'},
      {'metric': 'Tier 1', 'value': '14.2%', 'requirement': '10%', 'status': 'Compliant'},
    ],
    );
  }
}
