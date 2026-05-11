import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ReportingScreen extends StatelessWidget {
  const ReportingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Reporting',
      apiEndpoint: '/api/reports/v1/list',
      columnKeys: const ['id', 'name', 'type', 'period', 'status'],
      columnLabels: const ['ID', 'Report', 'Type', 'Period', 'Status'],
      seedData: const [
      {'id': 'RPT-001', 'name': 'Monthly P&L', 'type': 'Financial', 'period': 'May 2026', 'status': 'Generated'},
    ],
    );
  }
}
