import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CorporateMonitoringScreen extends StatelessWidget {
  const CorporateMonitoringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Corporate Monitoring',
      apiEndpoint: '/api/kyc-enhanced/corporate-events',
      columnKeys: const ['id', 'companyId', 'eventType', 'riskImpact'],
      columnLabels: const ['ID', 'Company', 'Event', 'Risk'],
      seedData: const [
        {'id': 'CORPORATE_MONITORING-001', 'status': 'active'},
        {'id': 'CORPORATE_MONITORING-002', 'status': 'pending'},
      ],
    );
  }
}
