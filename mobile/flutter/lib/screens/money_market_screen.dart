import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MoneyMarketScreen extends StatelessWidget {
  const MoneyMarketScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Money Market',
      apiEndpoint: '/api/treasury/v1/money-market',
      columnKeys: const ['id', 'instrument', 'counterparty', 'amount', 'rate'],
      columnLabels: const ['ID', 'Instrument', 'Counterparty', 'Amount', 'Rate'],
      seedData: const [
      {'id': 'MM-001', 'instrument': 'Treasury Bill', 'counterparty': 'CBN', 'amount': 'NGN 10B', 'rate': '12.5%'},
      {'id': 'MM-002', 'instrument': 'Repo', 'counterparty': 'Access Bank', 'amount': 'NGN 5B', 'rate': '11.0%'},
    ],
    );
  }
}
