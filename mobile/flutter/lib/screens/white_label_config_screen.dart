import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WhiteLabelConfigScreen extends StatelessWidget {
  const WhiteLabelConfigScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'White Label Config',
      apiEndpoint: '/api/white-label/v1/partners',
      columnKeys: const ['id', 'partner', 'brand', 'modules', 'status'],
      columnLabels: const ['ID', 'Partner', 'Brand', 'Modules', 'Status'],
      seedData: const [
      {'id': 'WL-001', 'partner': 'Sterling', 'brand': 'OneBank', 'modules': '12', 'status': 'Active'},
    ],
    );
  }
}
