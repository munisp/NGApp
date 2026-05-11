import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PermifyScreen extends StatelessWidget {
  const PermifyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Permify',
      apiEndpoint: '/api/permify/v1/schemas',
      columnKeys: const ['id', 'schema', 'relations', 'checks', 'status'],
      columnLabels: const ['ID', 'Schema', 'Relations', 'Checks/s', 'Status'],
      seedData: const [
      {'id': 'PRM-001', 'schema': 'banking', 'relations': '45', 'checks': '10K/s', 'status': 'Active'},
    ],
    );
  }
}
