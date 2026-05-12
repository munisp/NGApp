import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FraudfusionEnsembleScreen extends StatelessWidget {
  const FraudfusionEnsembleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FraudFusion Ensemble',
      apiEndpoint: '/api/ai-ml/fraudfusion/alerts',
      columnKeys: const ['id', 'ensembleScore', 'fraudType', 'amountNgn', 'status'],
      columnLabels: const ['ID', 'Score', 'Fraud Type', 'Amount', 'Status'],
      seedData: const [
        {'id': 'FRAUDFUSION_ENSEMBLE-001', 'status': 'active'},
        {'id': 'FRAUDFUSION_ENSEMBLE-002', 'status': 'pending'},
      ],
    );
  }
}
