import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AlertRulesScreen extends StatelessWidget {
  const AlertRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Alert Rules',
      apiEndpoint: '/api/platform/observability/alert-rules',
      columnKeys: const ['name', 'severity', 'forDuration', 'status'],
      columnLabels: const ['Alert', 'Severity', 'Duration', 'Status'],
      seedData: const [
              {'name': 'High Error Rate', 'severity': 'critical', 'forDuration': '2m', 'status': 'active'},
      ],
    );
  }
}
