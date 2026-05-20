import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FraudRulesScreen extends StatelessWidget {
  const FraudRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fraud Rules',
      apiEndpoint: '/api/fraud/v1/rules',
      columnKeys: const ['id', 'name', 'condition', 'action', 'status'],
      columnLabels: const ['ID', 'Rule', 'Condition', 'Action', 'Status'],
      seedData: const [
      {'id': 'FR-001', 'name': 'High Value Transfer', 'condition': 'Amount > 10M', 'action': 'Flag', 'status': 'Active'},
    ],
    );
  }
}
