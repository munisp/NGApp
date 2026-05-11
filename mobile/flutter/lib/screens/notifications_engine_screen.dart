import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NotificationsEngineScreen extends StatelessWidget {
  const NotificationsEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Notifications',
      apiEndpoint: '/api/notifications/v1/log',
      columnKeys: const ['id', 'channel', 'template', 'status'],
      columnLabels: const ['ID', 'Channel', 'Template', 'Status'],
      seedData: const [
      {'id': 'NOT-001', 'channel': 'SMS', 'template': 'Transaction Alert', 'status': 'Sent'},
      {'id': 'NOT-002', 'channel': 'Push', 'template': 'Low Balance', 'status': 'Sent'},
    ],
    );
  }
}
