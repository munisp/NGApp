import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycDataQualityScreen extends StatelessWidget {
  const KycDataQualityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Data Quality',
      apiEndpoint: '/api/kyc-enhanced/data-quality',
      columnKeys: const ['totalCustomers', 'kycCompletePct', 'expiredDocuments', 'duplicateBVN', 'missingNIN'],
      columnLabels: const ['Customers', 'Complete %', 'Expired', 'Dup BVN', 'No NIN'],
      seedData: const [
        {'id': 'KYC_DATA_QUALITY-001', 'status': 'active'},
        {'id': 'KYC_DATA_QUALITY-002', 'status': 'pending'},
      ],
    );
  }
}
