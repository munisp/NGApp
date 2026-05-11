import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EtlPipelinesScreen extends StatelessWidget {
  const EtlPipelinesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ETL Pipelines',
      apiEndpoint: '/api/etl/v1/pipelines',
      columnKeys: const ['id', 'name', 'source', 'target', 'status'],
      columnLabels: const ['ID', 'Pipeline', 'Source', 'Target', 'Status'],
      seedData: const [
      {'id': 'ETL-001', 'name': 'Daily Lakehouse Sync', 'source': 'Postgres', 'target': 'Lakehouse', 'status': 'Running'},
    ],
    );
  }
}
