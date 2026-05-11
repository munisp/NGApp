import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WebhookDeliveriesScreen extends StatelessWidget {
  const WebhookDeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Webhook Deliveries',
      apiEndpoint: '/api/webhooks/v1/deliveries',
      columnKeys: const ['id', 'webhook', 'response', 'status'],
      columnLabels: const ['ID', 'Webhook', 'Response', 'Status'],
      seedData: const [
      {'id': 'WHD-001', 'webhook': 'WH-001', 'response': '200 OK', 'status': 'Delivered'},
    ],
    );
  }
}
