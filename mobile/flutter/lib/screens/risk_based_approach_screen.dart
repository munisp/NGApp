import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RiskBasedApproachScreen extends StatelessWidget {
  const RiskBasedApproachScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Risk-Based Approach',
      apiEndpoint: '/api/kyc-enhanced/risk-scores',
      columnKeys: const ['id', 'customerId', 'staticScore', 'dynamicScore', 'totalScore', 'riskTier'],
      columnLabels: const ['ID', 'Customer', 'Static', 'Dynamic', 'Total', 'Risk Tier'],
      seedData: const [
        {'id': 'RISK_BASED_APPROACH-001', 'status': 'active'},
        {'id': 'RISK_BASED_APPROACH-002', 'status': 'pending'},
      ],
    );
  }
}
