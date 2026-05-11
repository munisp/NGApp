import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BatchEodScreen extends StatelessWidget {
  const BatchEodScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Batch / EOD',
      apiEndpoint: '/api/eod/v1/jobs',
      columnKeys: const ['id', 'name', 'schedule', 'status'],
      columnLabels: const ['ID', 'Job', 'Schedule', 'Status'],
      seedData: const [
      {'id': 'EOD-001', 'name': 'Interest Accrual', 'schedule': 'Daily 23:00', 'status': 'Completed'},
      {'id': 'EOD-002', 'name': 'GL Posting', 'schedule': 'Daily 23:30', 'status': 'Completed'},
    ],
    );
  }
}
