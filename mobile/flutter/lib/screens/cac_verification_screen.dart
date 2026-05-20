import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CacVerificationScreen extends StatelessWidget {
  const CacVerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CAC Company Verification',
      apiEndpoint: '/api/kyc-enhanced/cac-companies',
      columnKeys: const ['id', 'rcNumber', 'companyName', 'status', 'annualReturnsUpToDate'],
      columnLabels: const ['ID', 'RC Number', 'Company', 'Status', 'Annual Returns'],
      seedData: const [
        {'id': 'CAC_VERIFICATION-001', 'status': 'active'},
        {'id': 'CAC_VERIFICATION-002', 'status': 'pending'},
      ],
    );
  }
}
