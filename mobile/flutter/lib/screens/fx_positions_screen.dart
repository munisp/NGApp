import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FxPositionsScreen extends StatelessWidget {
  const FxPositionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FX Positions',
      apiEndpoint: '/api/fx/v1/positions',
      columnKeys: const ['currency', 'long', 'short', 'net'],
      columnLabels: const ['Currency', 'Long', 'Short', 'Net'],
      seedData: const [
      {'currency': 'USD', 'long': 'USD 500M', 'short': 'USD 350M', 'net': 'USD 150M'},
      {'currency': 'GBP', 'long': 'GBP 80M', 'short': 'GBP 60M', 'net': 'GBP 20M'},
    ],
    );
  }
}
