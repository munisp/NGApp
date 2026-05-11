import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseQueryFederationScreen extends StatelessWidget {
  const LakehouseQueryFederationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Query Federation',
      apiEndpoint: '/api/platform/lakehouse/queries',
      columnKeys: const ['id', 'name', 'sourceTable', 'consumingService', 'avgExecutionMs'],
      columnLabels: const ['ID', 'Name', 'Table', 'Consumer', 'Avg ms'],
      seedData: const [
              {'id': 'FQ-001', 'name': 'Customer Risk Profile', 'sourceTable': 'compliance_risk_scores', 'consumingService': 'kyc-engine-py', 'avgExecutionMs': '120'},
              {'id': 'FQ-002', 'name': 'Transaction Features', 'sourceTable': 'transaction_features', 'consumingService': 'fraud-detection-py', 'avgExecutionMs': '3500'},
      ],
    );
  }
}
