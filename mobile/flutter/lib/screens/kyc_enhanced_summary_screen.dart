import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycEnhancedSummaryScreen extends StatelessWidget {
  const KycEnhancedSummaryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Enhanced Suite Summary',
      apiEndpoint: '/api/kyc-enhanced/summary',
      columnKeys: const ['totalNewServices', 'tierDefinitions', 'monitoringRules', 'sanctionsLists'],
      columnLabels: const ['Services', 'Tiers', 'Rules', 'Lists'],
      seedData: const [
        {'id': 'KYC_ENHANCED_SUMMARY-001', 'status': 'active'},
        {'id': 'KYC_ENHANCED_SUMMARY-002', 'status': 'pending'},
      ],
    );
  }
}
