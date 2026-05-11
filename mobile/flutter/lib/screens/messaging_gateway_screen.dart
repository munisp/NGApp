import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MessagingGatewayScreen extends StatelessWidget {
  const MessagingGatewayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Messaging Gateway',
      apiEndpoint: '/api/messaging/v1/providers',
      columnKeys: const ['id', 'provider', 'type', 'volume', 'status'],
      columnLabels: const ['ID', 'Provider', 'Type', 'Volume/Day', 'Status'],
      seedData: const [
      {'id': 'MSG-001', 'provider': 'Twilio', 'type': 'SMS', 'volume': '50K', 'status': 'Active'},
      {'id': 'MSG-002', 'provider': 'SendGrid', 'type': 'Email', 'volume': '120K', 'status': 'Active'},
    ],
    );
  }
}
