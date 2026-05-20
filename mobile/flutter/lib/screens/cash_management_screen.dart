import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CashManagementScreen extends StatelessWidget {
  const CashManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cash Management',
      apiEndpoint: '/api/cash/v1/positions',
      columnKeys: const ['vault', 'currency', 'balance', 'lastCount'],
      columnLabels: const ['Vault', 'Ccy', 'Balance', 'Last Count'],
      seedData: const [
      {'vault': 'Marina Main Vault', 'currency': 'NGN', 'balance': 'NGN 2.5B', 'lastCount': '2026-05-09 06:00'},
    ],
    );
  }
}
