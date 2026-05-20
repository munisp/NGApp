import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycSelfServiceScreen extends StatelessWidget {
  const KycSelfServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Self-Service KYC',
      apiEndpoint: '/api/kyc-enhanced/customer-tiers',
      columnKeys: const ['id', 'customerName', 'currentTier', 'status'],
      columnLabels: const ['ID', 'Customer', 'Tier', 'Status'],
      seedData: const [
        {'id': 'KYC_SELF_SERVICE-001', 'status': 'active'},
        {'id': 'KYC_SELF_SERVICE-002', 'status': 'pending'},
      ],
    );
  }
}
