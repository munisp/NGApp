import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LivenessDetectionScreen extends StatelessWidget {
  const LivenessDetectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Liveness Detection',
      apiEndpoint: '/api/kyc/v1/liveness',
      columnKeys: const ['id', 'customer', 'confidence', 'status'],
      columnLabels: const ['ID', 'Customer', 'Confidence', 'Status'],
      seedData: const [
      {'id': 'LIV-001', 'customer': 'Amina Bello', 'confidence': '99.2%', 'status': 'Passed'},
    ],
    );
  }
}
