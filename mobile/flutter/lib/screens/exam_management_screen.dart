import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ExamManagementScreen extends StatelessWidget {
  const ExamManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Regulatory Exams',
      apiEndpoint: '/api/regulatory/v1/exams',
      columnKeys: const ['id', 'regulator', 'type', 'date', 'status'],
      columnLabels: const ['ID', 'Regulator', 'Type', 'Date', 'Status'],
      seedData: const [
      {'id': 'EXM-001', 'regulator': 'CBN', 'type': 'Routine', 'date': '2026-07-15', 'status': 'Scheduled'},
    ],
    );
  }
}
