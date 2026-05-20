import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SignatureVerificationScreen extends StatelessWidget {
  const SignatureVerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Signature Verification',
      apiEndpoint: '/api/kyc/v1/signatures',
      columnKeys: const ['id', 'customer', 'confidence', 'status'],
      columnLabels: const ['ID', 'Customer', 'Confidence', 'Status'],
      seedData: const [
      {'id': 'SIG-001', 'customer': 'Chief Emeka Offor', 'confidence': '96.8%', 'status': 'Verified'},
    ],
    );
  }
}
