import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseScreen extends StatelessWidget {
  const LakehouseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Lakehouse',
      apiEndpoint: '/api/lakehouse/v1/schemas',
      columnKeys: const ['id', 'schema', 'tables', 'size'],
      columnLabels: const ['ID', 'Schema', 'Tables', 'Total Size'],
      seedData: const [
      {'id': 'LKH-001', 'schema': 'analytics', 'tables': '25', 'size': '120 GB'},
    ],
    );
  }
}
