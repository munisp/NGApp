import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ChartOfAccountsScreen extends StatelessWidget {
  const ChartOfAccountsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Chart of Accounts',
      apiEndpoint: '/api/gl/v1/chart-of-accounts',
      columnKeys: const ['code', 'name', 'type', 'balance', 'status'],
      columnLabels: const ['Code', 'Account', 'Type', 'Balance', 'Status'],
      seedData: const [
      {'code': '1000', 'name': 'Cash at CBN', 'type': 'Asset', 'balance': 'NGN 450B', 'status': 'Active'},
      {'code': '2000', 'name': 'Customer Deposits', 'type': 'Liability', 'balance': 'NGN 2.4T', 'status': 'Active'},
      {'code': '3000', 'name': 'Share Capital', 'type': 'Equity', 'balance': 'NGN 150B', 'status': 'Active'},
      {'code': '4000', 'name': 'Interest Income', 'type': 'Revenue', 'balance': 'NGN 89B', 'status': 'Active'},
      {'code': '5000', 'name': 'Interest Expense', 'type': 'Expense', 'balance': 'NGN 34B', 'status': 'Active'},
    ],
    );
  }
}
