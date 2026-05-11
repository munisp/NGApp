import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FxRatesScreen extends StatelessWidget {
  const FxRatesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FX Rates',
      apiEndpoint: '/api/fx/v1/rates',
      columnKeys: const ['pair', 'buy', 'sell', 'mid', 'source'],
      columnLabels: const ['Pair', 'Buy', 'Sell', 'Mid', 'Source'],
      seedData: const [
      {'pair': 'USD/NGN', 'buy': '1,550', 'sell': '1,580', 'mid': '1,565', 'source': 'CBN-NAFEM'},
      {'pair': 'GBP/NGN', 'buy': '1,980', 'sell': '2,020', 'mid': '2,000', 'source': 'CBN-NAFEM'},
      {'pair': 'EUR/NGN', 'buy': '1,680', 'sell': '1,720', 'mid': '1,700', 'source': 'CBN-NAFEM'},
    ],
    );
  }
}
