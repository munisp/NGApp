import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerNotificationsScreen extends StatelessWidget {
  const CustomerNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Notifications',
      apiEndpoint: '/api/notifications/v1/customer',
      columnKeys: const ['id', 'title', 'time', 'read'],
      columnLabels: const ['ID', 'Title', 'Time', 'Read'],
      seedData: const [
      {'id': 'CN-001', 'title': 'Transfer Completed', 'time': '14:30', 'read': 'Yes'},
      {'id': 'CN-002', 'title': 'Card Blocked', 'time': '12:15', 'read': 'No'},
    ],
    );
  }
}
