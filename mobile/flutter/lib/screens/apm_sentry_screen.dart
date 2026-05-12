import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApmSentryScreen extends StatelessWidget {
  const ApmSentryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'APM Sentry',
      apiEndpoint: '/api/production/apm-sentry/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'APM_SENTRY_SCREEN-001', 'status': 'active'},
        {'id': 'APM_SENTRY_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
