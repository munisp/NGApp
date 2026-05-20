import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BankGuaranteesScreen extends StatelessWidget {
  const BankGuaranteesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Bank Guarantees',
      apiEndpoint: '/api/trade/v1/guarantees',
      columnKeys: const ['id', 'applicant', 'type', 'amount', 'status'],
      columnLabels: const ['ID', 'Applicant', 'Type', 'Amount', 'Status'],
      seedData: const [
      {'id': 'BG-001', 'applicant': 'Julius Berger', 'type': 'Performance', 'amount': 'NGN 15B', 'status': 'Active'},
    ],
    );
  }
}
