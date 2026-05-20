import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AccountingRulesScreen extends StatelessWidget {
  const AccountingRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Accounting Rules',
      apiEndpoint: '/api/accounting/v1/rules',
      columnKeys: const ['id', 'name', 'type', 'status'],
      columnLabels: const ['ID', 'Rule', 'Type', 'Status'],
      seedData: const [
      {'id': 'AR-001', 'name': 'Loan Interest Accrual', 'type': 'Automatic', 'status': 'Active'},
    ],
    );
  }
}
