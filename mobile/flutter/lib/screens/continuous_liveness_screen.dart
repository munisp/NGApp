import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ContinuousLivenessScreen extends StatelessWidget {
  const ContinuousLivenessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Continuous Liveness',
      apiEndpoint: '/api/kyc-enhanced/step-up-configs',
      columnKeys: const ['trigger', 'threshold', 'methods'],
      columnLabels: const ['Trigger', 'Threshold', 'Methods'],
      seedData: const [
        {'id': 'CONTINUOUS_LIVENESS-001', 'status': 'active'},
        {'id': 'CONTINUOUS_LIVENESS-002', 'status': 'pending'},
      ],
    );
  }
}
