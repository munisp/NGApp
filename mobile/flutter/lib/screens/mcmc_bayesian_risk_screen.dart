import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class McmcBayesianRiskScreen extends StatelessWidget {
  const McmcBayesianRiskScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'MCMC Bayesian Risk',
      apiEndpoint: '/api/ai-ml/mcmc/posteriors',
      columnKeys: const ['id', 'customerId', 'model', 'posteriorMean', 'riskGrade'],
      columnLabels: const ['ID', 'Customer', 'Model', 'Mean', 'Grade'],
      seedData: const [
        {'id': 'MCMC_BAYESIAN_RISK-001', 'status': 'active'},
        {'id': 'MCMC_BAYESIAN_RISK-002', 'status': 'pending'},
      ],
    );
  }
}
