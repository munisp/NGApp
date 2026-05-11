import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycServiceGatesScreen extends StatelessWidget {
  const KycServiceGatesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Service Gates',
      apiEndpoint: '/api/kyc/v1/service-gates',
      columnKeys: const ['id', 'gate', 'threshold', 'status'],
      columnLabels: const ['ID', 'Gate', 'Threshold', 'Status'],
      seedData: const [
      {'id': 'KSG-001', 'gate': 'Account Opening', 'threshold': 'Tier 1 KYC', 'status': 'Active'},
    ],
    );
  }
}
