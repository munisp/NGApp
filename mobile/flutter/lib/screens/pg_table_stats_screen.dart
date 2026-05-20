import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PgTableStatsScreen extends StatelessWidget {
  const PgTableStatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Table Stats',
      apiEndpoint: '/api/platform/postgres/table-stats',
      columnKeys: const ['table', 'estimatedRows', 'bloatPct', 'deadRows', 'status'],
      columnLabels: const ['Table', 'Rows', 'Bloat %', 'Dead', 'Status'],
      seedData: const [
              {'table': 'transactions', 'estimatedRows': '45M', 'bloatPct': '2.1', 'deadRows': '500K', 'status': 'healthy'},
              {'table': 'audit_trail', 'estimatedRows': '125M', 'bloatPct': '12.8', 'deadRows': '5M', 'status': 'bloated'},
      ],
    );
  }
}
