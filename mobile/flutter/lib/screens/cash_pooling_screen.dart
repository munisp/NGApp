import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CashPoolingScreen extends StatelessWidget {
  const CashPoolingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cash Pooling',
      apiEndpoint: '/api/cash/v1/pooling',
      columnKeys: const ['id', 'group', 'accounts', 'balance', 'status'],
      columnLabels: const ['ID', 'Group', 'Accounts', 'Total', 'Status'],
      seedData: const [
      {'id': 'CP-001', 'group': 'Dangote Group', 'accounts': '12', 'balance': 'NGN 45B', 'status': 'Active'},
    ],
    );
  }
}
