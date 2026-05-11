import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LedgerScreen extends StatelessWidget {
  const LedgerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'General Ledger',
      apiEndpoint: '/api/gl/v1/ledger',
      columnKeys: const ['id', 'account', 'type', 'balance', 'currency'],
      columnLabels: const ['ID', 'Account', 'Type', 'Balance', 'Currency'],
      seedData: const [
      {'id': 'LED-001', 'account': '1001 - Cash & Equivalents', 'type': 'Asset', 'balance': 'NGN 450B', 'currency': 'NGN'},
      {'id': 'LED-002', 'account': '2001 - Customer Deposits', 'type': 'Liability', 'balance': 'NGN 1.2T', 'currency': 'NGN'},
      {'id': 'LED-003', 'account': '3001 - Share Capital', 'type': 'Equity', 'balance': 'NGN 200B', 'currency': 'NGN'},
      {'id': 'LED-004', 'account': '4001 - Interest Income', 'type': 'Revenue', 'balance': 'NGN 89B', 'currency': 'NGN'},
      {'id': 'LED-005', 'account': '5001 - Operating Expenses', 'type': 'Expense', 'balance': 'NGN 45B', 'currency': 'NGN'},
    ],
    );
  }
}
