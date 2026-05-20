import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EodProcessorScreen extends StatelessWidget {
  const EodProcessorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'EOD Processor',
      apiEndpoint: '/api/eod/v1/steps',
      columnKeys: const ['id', 'step', 'duration', 'status'],
      columnLabels: const ['ID', 'Step', 'Duration', 'Status'],
      seedData: const [
      {'id': 'EOD-001', 'step': 'Interest Posting', 'duration': '45s', 'status': 'Completed'},
      {'id': 'EOD-002', 'step': 'GL Balancing', 'duration': '30s', 'status': 'Completed'},
    ],
    );
  }
}
