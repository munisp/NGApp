import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GlAccountsScreen extends StatelessWidget {
  const GlAccountsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'GL Accounts',
      apiEndpoint: '/api/gl/v1/accounts',
      columnKeys: const ['code', 'name', 'debit', 'credit', 'balance'],
      columnLabels: const ['Code', 'Name', 'Debit', 'Credit', 'Balance'],
      seedData: const [
      {'code': '1001', 'name': 'Vault Cash - Marina', 'debit': 'NGN 2.5B', 'credit': 'NGN 1.8B', 'balance': 'NGN 700M'},
    ],
    );
  }
}
