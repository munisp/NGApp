import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RetryPoliciesScreen extends StatelessWidget {
  const RetryPoliciesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Retry Policies',
      apiEndpoint: '/api/platform/retry-policies',
      columnKeys: const ['id', 'name', 'maxRetries', 'baseDelayMs', 'backoffMultiplier'],
      columnLabels: const ['ID', 'Name', 'Max Retries', 'Base Delay', 'Multiplier'],
      seedData: const [
              {'id': 'RP-001', 'name': 'Default API', 'maxRetries': '3', 'baseDelayMs': '1000', 'backoffMultiplier': '2.0'},
              {'id': 'RP-002', 'name': 'Financial Transaction', 'maxRetries': '5', 'baseDelayMs': '2000', 'backoffMultiplier': '2.0'},
      ],
    );
  }
}
