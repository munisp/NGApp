import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LoanAccountsScreen extends StatelessWidget {
  const LoanAccountsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Loan Accounts',
      apiEndpoint: '/api/loans/v1/accounts',
      columnKeys: const ['id', 'customer', 'outstanding', 'nextPmt', 'status'],
      columnLabels: const ['ID', 'Customer', 'Outstanding', 'Next Payment', 'Status'],
      seedData: const [
      {'id': 'LA-001', 'customer': 'Dangote Agrosacks', 'outstanding': 'NGN 4.8B', 'nextPmt': '2026-06-01', 'status': 'Performing'},
      {'id': 'LA-002', 'customer': 'Amina Bello', 'outstanding': 'NGN 1.5M', 'nextPmt': '2026-05-28', 'status': 'Performing'},
    ],
    );
  }
}
