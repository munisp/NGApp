import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InfraLakehouseScreen extends StatelessWidget {
  const InfraLakehouseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Infra: Lakehouse',
      apiEndpoint: '/api/infra/v1/lakehouse',
      columnKeys: const ['id', 'table', 'rows', 'size'],
      columnLabels: const ['ID', 'Table', 'Rows', 'Size'],
      seedData: const [
      {'id': 'LH-001', 'table': 'transactions', 'rows': '45M', 'size': '12 GB'},
    ],
    );
  }
}
