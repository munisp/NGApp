import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WebhookEngineScreen extends StatelessWidget {
  const WebhookEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Webhook Engine',
      apiEndpoint: '/api/webhooks/v1/engine',
      columnKeys: const ['id', 'name', 'endpoints', 'status'],
      columnLabels: const ['ID', 'Engine', 'Endpoints', 'Status'],
      seedData: const [
      {'id': 'WHE-001', 'name': 'Event Dispatcher', 'endpoints': '45', 'status': 'Active'},
    ],
    );
  }
}
