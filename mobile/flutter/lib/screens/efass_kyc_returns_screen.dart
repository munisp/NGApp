import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EfassKycReturnsScreen extends StatelessWidget {
  const EfassKycReturnsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CBN eFASS KYC Returns',
      apiEndpoint: '/api/kyc-enhanced/efass-returns',
      columnKeys: const ['id', 'period', 'type', 'tier1Count', 'tier2Count', 'tier3Count', 'status'],
      columnLabels: const ['ID', 'Period', 'Type', 'Tier1', 'Tier2', 'Tier3', 'Status'],
      seedData: const [
        {'id': 'EFASS_KYC_RETURNS-001', 'status': 'active'},
        {'id': 'EFASS_KYC_RETURNS-002', 'status': 'pending'},
      ],
    );
  }
}
