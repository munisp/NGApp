import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OpenBankingScreen extends StatelessWidget {
  const OpenBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Open Banking',
      apiEndpoint: '/api/open-banking/v1/tpps',
      columnKeys: const ['id', 'name', 'type', 'license', 'status'],
      columnLabels: const ['ID', 'TPP', 'Type', 'License', 'Status'],
      seedData: const [
      {'id': 'TPP-001', 'name': 'Paystack', 'type': 'PISP', 'license': 'CBN/PSP/2024/001', 'status': 'Active'},
      {'id': 'TPP-002', 'name': 'Flutterwave', 'type': 'AISP', 'license': 'CBN/PSP/2024/002', 'status': 'Active'},
    ],
    );
  }
}
