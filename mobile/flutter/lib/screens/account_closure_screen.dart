import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AccountClosureScreen extends StatelessWidget {
  const AccountClosureScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Account Closure',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'ACCOUNT_CLOSURE_SCREEN-001', 'status': 'active'},
        {'id': 'ACCOUNT_CLOSURE_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
