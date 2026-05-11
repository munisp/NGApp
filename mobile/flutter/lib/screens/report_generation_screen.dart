import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ReportGenerationScreen extends StatelessWidget {
  const ReportGenerationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Reports',
      apiEndpoint: '/api/reports/v1/generated',
      columnKeys: const ['id', 'name', 'format', 'status'],
      columnLabels: const ['ID', 'Report', 'Format', 'Status'],
      seedData: const [
      {'id': 'RPT-001', 'name': 'CBN eFASS May 2026', 'format': 'PDF', 'status': 'Generated'},
    ],
    );
  }
}
