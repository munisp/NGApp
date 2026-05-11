import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AiFraudDetectionScreen extends StatelessWidget {
  const AiFraudDetectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'AI Fraud Detection',
      apiEndpoint: '/api/fraud/v1/ml-alerts',
      columnKeys: const ['id', 'score', 'rule', 'amount', 'action'],
      columnLabels: const ['ID', 'Score', 'Rule', 'Amount', 'Action'],
      seedData: const [
      {'id': 'AIF-001', 'score': '95', 'rule': 'ML Anomaly', 'amount': 'NGN 45M', 'action': 'Blocked'},
    ],
    );
  }
}
