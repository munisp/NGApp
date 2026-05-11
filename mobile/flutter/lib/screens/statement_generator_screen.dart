import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StatementGeneratorScreen extends StatelessWidget {
  const StatementGeneratorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Statement Generator',
      apiEndpoint: '/api/statements/v1/generate',
      columnKeys: const ['id', 'account', 'period', 'format', 'status'],
      columnLabels: const ['ID', 'Account', 'Period', 'Format', 'Status'],
      seedData: const [
      {'id': 'STG-001', 'account': '0012345678', 'period': 'May 2026', 'format': 'PDF', 'status': 'Generated'},
    ],
    );
  }
}
