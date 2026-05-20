import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WakalaInvestmentScreen extends StatelessWidget {
  const WakalaInvestmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Wakala Investment',
      apiEndpoint: '/api/islamic/v1/wakala',
      columnKeys: const ['id', 'investor', 'amount', 'return', 'status'],
      columnLabels: const ['ID', 'Investor', 'Amount', 'Return', 'Status'],
      seedData: const [
      {'id': 'WAK-001', 'investor': 'Islamic Fund', 'amount': 'NGN 5B', 'return': '8.5%', 'status': 'Active'},
    ],
    );
  }
}
