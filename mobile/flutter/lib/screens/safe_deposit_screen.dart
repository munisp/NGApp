import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SafeDepositScreen extends StatelessWidget {
  const SafeDepositScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Safe Deposit',
      apiEndpoint: '/api/safe-deposit/v1/boxes',
      columnKeys: const ['id', 'customer', 'boxSize', 'branch', 'status'],
      columnLabels: const ['ID', 'Customer', 'Size', 'Branch', 'Status'],
      seedData: const [
      {'id': 'SDB-001', 'customer': 'Chief Emeka Offor', 'boxSize': 'Large', 'branch': 'Marina HQ', 'status': 'Rented'},
    ],
    );
  }
}
