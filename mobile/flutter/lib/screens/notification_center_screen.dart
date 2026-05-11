import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NotificationCenterScreen extends StatelessWidget {
  const NotificationCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Notification Center',
      apiEndpoint: '/api/notifications/v1/inbox',
      columnKeys: const ['id', 'title', 'type', 'read', 'time'],
      columnLabels: const ['ID', 'Title', 'Type', 'Read', 'Time'],
      seedData: const [
      {'id': 'NC-001', 'title': 'Transfer Completed', 'type': 'Transaction', 'read': 'Yes', 'time': '14:30'},
    ],
    );
  }
}
