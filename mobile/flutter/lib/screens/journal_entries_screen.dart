import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class JournalEntriesScreen extends StatelessWidget {
  const JournalEntriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Journal Entries',
      apiEndpoint: '/api/gl/v1/journals',
      columnKeys: const ['id', 'date', 'description', 'amount', 'status'],
      columnLabels: const ['ID', 'Date', 'Description', 'Amount', 'Status'],
      seedData: const [
      {'id': 'JE-001', 'date': '2026-05-09', 'description': 'Daily interest accrual', 'amount': 'NGN 245M', 'status': 'Posted'},
    ],
    );
  }
}
