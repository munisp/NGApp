import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ReconciliationScreen extends StatelessWidget {
  const ReconciliationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Reconciliation',
      apiEndpoint: '/api/reconciliation/v1/jobs',
      columnKeys: const ['id', 'type', 'date', 'matched', 'exceptions', 'status'],
      columnLabels: const ['ID', 'Type', 'Date', 'Matched', 'Exceptions', 'Status'],
      seedData: const [
      {'id': 'REC-001', 'type': 'NIBSS Settlement', 'date': '2026-05-09', 'matched': '99.8%', 'exceptions': '12', 'status': 'Completed'},
    ],
    );
  }
}
