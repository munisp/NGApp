import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CardTokensScreen extends StatelessWidget {
  const CardTokensScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Card Tokenization',
      apiEndpoint: '/api/cards/v1/tokens',
      columnKeys: const ['token', 'pan', 'merchant', 'status'],
      columnLabels: const ['Token', 'Card', 'Merchant', 'Status'],
      seedData: const [
      {'token': 'TKN-001', 'pan': '****5234', 'merchant': 'Netflix', 'status': 'Active'},
    ],
    );
  }
}
