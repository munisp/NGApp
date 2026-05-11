import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycTieredDashboardScreen extends StatelessWidget {
  const KycTieredDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CBN Tiered KYC Dashboard',
      apiEndpoint: '/api/kyc-enhanced/customer-tiers',
      columnKeys: const ['id', 'customerName', 'currentTier', 'dailyLimitNGN', 'evaluationScore', 'status'],
      columnLabels: const ['ID', 'Customer', 'Tier', 'Daily Limit', 'Score', 'Status'],
      seedData: const [
        {'id': 'KYC_TIERED_DASHBOARD-001', 'status': 'active'},
        {'id': 'KYC_TIERED_DASHBOARD-002', 'status': 'pending'},
      ],
    );
  }
}
