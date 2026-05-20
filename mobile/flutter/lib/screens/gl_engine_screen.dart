import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GlEngineScreen extends StatelessWidget {
  const GlEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'GL Engine',
      apiEndpoint: '/api/gl-engine/v1/stats',
      columnKeys: const ['metric', 'value'],
      columnLabels: const ['Metric', 'Value'],
      seedData: const [
      {'metric': 'Total Accounts', 'value': '18'},
      {'metric': 'Double Entry Enforced', 'value': 'Yes'},
      {'metric': 'Trial Balance', 'value': 'Balanced'},
      {'metric': 'Period', 'value': 'May 2026'},
    ],
    );
  }
}
