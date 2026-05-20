import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CardFraudRulesScreen extends StatelessWidget {
  const CardFraudRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Card Fraud Rules',
      apiEndpoint: '/api/cards/v1/fraud-rules',
      columnKeys: const ['id', 'name', 'condition', 'action', 'status'],
      columnLabels: const ['ID', 'Rule', 'Condition', 'Action', 'Status'],
      seedData: const [
      {'id': 'CFR-001', 'name': 'High Value Intl', 'condition': 'Amount > USD 5K', 'action': 'Block + SMS', 'status': 'Active'},
      {'id': 'CFR-002', 'name': 'Rapid Successive', 'condition': '> 5 txns in 2 min', 'action': 'Temp Block', 'status': 'Active'},
    ],
    );
  }
}
