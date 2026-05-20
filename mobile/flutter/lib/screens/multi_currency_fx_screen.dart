import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MultiCurrencyFxScreen extends StatelessWidget {
  const MultiCurrencyFxScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Multi-Currency FX',
      apiEndpoint: '/api/fx/v1/rates',
      columnKeys: const ['base', 'quote', 'buy', 'sell', 'source'],
      columnLabels: const ['Base', 'Quote', 'Buy', 'Sell', 'Source'],
      seedData: const [
      {'base': 'USD', 'quote': 'NGN', 'buy': '1,550', 'sell': '1,580', 'source': 'CBN-NAFEM'},
    ],
    );
  }
}
