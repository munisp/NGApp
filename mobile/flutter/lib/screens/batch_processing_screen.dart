import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BatchProcessingScreen extends StatelessWidget {
  const BatchProcessingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Batch Processing',
      apiEndpoint: '/api/batch/v1/jobs',
      columnKeys: const ['id', 'name', 'records', 'status'],
      columnLabels: const ['ID', 'Batch', 'Records', 'Status'],
      seedData: const [
      {'id': 'BAT-001', 'name': 'Salary Upload', 'records': '3,200', 'status': 'Processed'},
    ],
    );
  }
}
