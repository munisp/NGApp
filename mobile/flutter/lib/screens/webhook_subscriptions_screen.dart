import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WebhookSubscriptionsScreen extends StatelessWidget {
  const WebhookSubscriptionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Webhooks',
      apiEndpoint: '/api/webhooks/v1/subscriptions',
      columnKeys: const ['id', 'url', 'events', 'status'],
      columnLabels: const ['ID', 'URL', 'Events', 'Status'],
      seedData: const [
      {'id': 'WH-001', 'url': 'https://partner.com/hook', 'events': 'txn.created', 'status': 'Active'},
    ],
    );
  }
}
