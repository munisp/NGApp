import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TxnMonitoringRulesScreen extends StatelessWidget {
  const TxnMonitoringRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Transaction Monitoring Rules',
      apiEndpoint: '/api/kyc-enhanced/monitoring-rules',
      columnKeys: const ['id', 'name', 'category', 'scenarioCode', 'riskScoreImpact', 'enabled'],
      columnLabels: const ['ID', 'Rule', 'Category', 'CBN Code', 'Impact', 'Enabled'],
      seedData: const [
        {'id': 'TXN_MONITORING_RULES-001', 'status': 'active'},
        {'id': 'TXN_MONITORING_RULES-002', 'status': 'pending'},
      ],
    );
  }
}
