import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DataExportScreen extends StatelessWidget {
  const DataExportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Data Export',
      apiEndpoint: '/api/exports/v1/jobs',
      columnKeys: const ['id', 'name', 'format', 'records', 'status'],
      columnLabels: const ['ID', 'Export', 'Format', 'Records', 'Status'],
      seedData: const [
      {'id': 'EXP-001', 'name': 'Customer List', 'format': 'CSV', 'records': '245,000', 'status': 'Ready'},
    ],
    );
  }
}
