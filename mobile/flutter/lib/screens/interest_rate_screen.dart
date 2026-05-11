import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InterestRateScreen extends StatelessWidget {
  const InterestRateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Interest Rate Config',
      apiEndpoint: '/api/interest/v1/rates',
      columnKeys: const ['id', 'name', 'baseRate', 'spread', 'effective'],
      columnLabels: const ['ID', 'Product', 'Base', 'Spread', 'Effective'],
      seedData: const [
      {'id': 'IR-001', 'name': 'Savings', 'baseRate': '4.0%', 'spread': '0.5%', 'effective': '4.5%'},
      {'id': 'IR-002', 'name': 'MPR Reference', 'baseRate': '18.75%', 'spread': '0%', 'effective': '18.75%'},
    ],
    );
  }
}
