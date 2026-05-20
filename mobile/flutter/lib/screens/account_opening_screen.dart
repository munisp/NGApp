import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AccountOpeningScreen extends StatelessWidget {
  const AccountOpeningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Account Opening',
      apiEndpoint: '/api/accounts/v1/applications',
      columnKeys: const ['id', 'customer', 'type', 'currency', 'status'],
      columnLabels: const ['ID', 'Customer', 'Type', 'Currency', 'Status'],
      seedData: const [
      {'id': 'ACC-001', 'customer': 'Dangote Industries Ltd', 'type': 'Corporate Current', 'currency': 'NGN', 'status': 'Active'},
      {'id': 'ACC-002', 'customer': 'Amina Bello', 'type': 'Savings', 'currency': 'NGN', 'status': 'Active'},
      {'id': 'ACC-003', 'customer': 'BUA Cement Plc', 'type': 'Domiciliary', 'currency': 'USD', 'status': 'Active'},
      {'id': 'ACC-004', 'customer': 'Chidi Eze', 'type': 'Fixed Deposit', 'currency': 'NGN', 'status': 'Pending'},
    ],
    );
  }
}
