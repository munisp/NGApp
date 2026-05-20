import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AccountStatementsScreen extends StatelessWidget {
  const AccountStatementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Account Statements',
      apiEndpoint: '/api/accounts/v1/statements',
      columnKeys: const ['date', 'description', 'debit', 'credit', 'balance'],
      columnLabels: const ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      seedData: const [
      {'date': '2026-05-09', 'description': 'Transfer to GTBank', 'debit': '500,000', 'credit': '-', 'balance': '24,500,000'},
      {'date': '2026-05-09', 'description': 'Salary Credit', 'debit': '-', 'credit': '2,500,000', 'balance': '25,000,000'},
      {'date': '2026-05-08', 'description': 'POS Shoprite', 'debit': '45,000', 'credit': '-', 'balance': '22,545,000'},
    ],
    );
  }
}
