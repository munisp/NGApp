import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InterbankLendingScreen extends StatelessWidget {
  const InterbankLendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Interbank Lending',
      apiEndpoint: '/api/interbank/v1/deals',
      columnKeys: const ['id', 'counterparty', 'amount', 'rate', 'status'],
      columnLabels: const ['ID', 'Counterparty', 'Amount', 'Rate', 'Status'],
      seedData: const [
      {'id': 'IB-001', 'counterparty': 'Zenith Bank', 'amount': 'NGN 20B', 'rate': '13.0%', 'status': 'Active'},
    ],
    );
  }
}
