import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EprKgqaScreen extends StatelessWidget {
  const EprKgqaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'EPR-KGQA Knowledge QA',
      apiEndpoint: '/api/ai-ml/kgqa/samples',
      columnKeys: const ['id', 'question', 'latencyMs'],
      columnLabels: const ['ID', 'Question', 'Latency'],
      seedData: const [
        {'id': 'EPR_KGQA-001', 'status': 'active'},
        {'id': 'EPR_KGQA-002', 'status': 'pending'},
      ],
    );
  }
}
