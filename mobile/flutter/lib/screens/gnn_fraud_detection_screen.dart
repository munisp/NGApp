import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GnnFraudDetectionScreen extends StatelessWidget {
  const GnnFraudDetectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'GNN Fraud Detection',
      apiEndpoint: '/api/ai-ml/gnn/predictions',
      columnKeys: const ['id', 'model', 'customerId', 'prediction', 'confidence', 'riskScore'],
      columnLabels: const ['ID', 'Model', 'Customer', 'Prediction', 'Confidence', 'Risk Score'],
      seedData: const [
        {'id': 'GNN_FRAUD_DETECTION-001', 'status': 'active'},
        {'id': 'GNN_FRAUD_DETECTION-002', 'status': 'pending'},
      ],
    );
  }
}
