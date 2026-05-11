import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StatementHistoryScreen extends StatelessWidget {
  const StatementHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Statement History',
      apiEndpoint: '/api/statements/v1/history',
      columnKeys: const ['id', 'account', 'period', 'downloads'],
      columnLabels: const ['ID', 'Account', 'Period', 'Downloads'],
      seedData: const [
      {'id': 'STH-001', 'account': '0012345678', 'period': 'Apr 2026', 'downloads': '3'},
    ],
    );
  }
}
