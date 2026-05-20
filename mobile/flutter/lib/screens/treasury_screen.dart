import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TreasuryScreen extends StatelessWidget {
  const TreasuryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Treasury',
      apiEndpoint: '/api/treasury/v1/positions',
      columnKeys: const ['currency', 'balance', 'limit', 'utilization'],
      columnLabels: const ['Currency', 'Balance', 'Limit', 'Util'],
      seedData: const [
      {'currency': 'NGN', 'balance': 'NGN 450B', 'limit': 'NGN 600B', 'utilization': '75%'},
      {'currency': 'USD', 'balance': 'USD 2.1B', 'limit': 'USD 3B', 'utilization': '70%'},
      {'currency': 'GBP', 'balance': 'GBP 180M', 'limit': 'GBP 250M', 'utilization': '72%'},
      {'currency': 'EUR', 'balance': 'EUR 95M', 'limit': 'EUR 150M', 'utilization': '63%'},
    ],
    );
  }
}
