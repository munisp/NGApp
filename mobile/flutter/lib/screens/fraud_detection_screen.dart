import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FraudDetectionScreen extends StatelessWidget {
  const FraudDetectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fraud Detection',
      apiEndpoint: '/api/fraud/v1/alerts',
      columnKeys: const ['id', 'txnId', 'score', 'rule', 'action'],
      columnLabels: const ['ID', 'Transaction', 'Score', 'Rule', 'Action'],
      seedData: const [
      {'id': 'FRA-001', 'txnId': 'PAY-999', 'score': '92', 'rule': 'Velocity Check', 'action': 'Blocked'},
    ],
    );
  }
}
