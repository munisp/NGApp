import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SarReportsScreen extends StatelessWidget {
  const SarReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SAR Reports',
      apiEndpoint: '/api/sar/v1/reports',
      columnKeys: const ['id', 'subject', 'type', 'amount', 'status'],
      columnLabels: const ['ID', 'Subject', 'Type', 'Amount', 'Status'],
      seedData: const [
      {'id': 'SAR-001', 'subject': 'Suspicious Entity', 'type': 'Structuring', 'amount': 'NGN 500M', 'status': 'Filed'},
    ],
    );
  }
}
