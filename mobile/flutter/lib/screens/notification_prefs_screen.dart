import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NotificationPrefsScreen extends StatelessWidget {
  const NotificationPrefsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Notification Preferences',
      apiEndpoint: '/api/notifications/v1/preferences',
      columnKeys: const ['channel', 'txnAlerts', 'marketing', 'security'],
      columnLabels: const ['Channel', 'Txn Alerts', 'Marketing', 'Security'],
      seedData: const [
      {'channel': 'SMS', 'txnAlerts': 'Enabled', 'marketing': 'Disabled', 'security': 'Enabled'},
      {'channel': 'Email', 'txnAlerts': 'Enabled', 'marketing': 'Enabled', 'security': 'Enabled'},
      {'channel': 'Push', 'txnAlerts': 'Enabled', 'marketing': 'Disabled', 'security': 'Enabled'},
    ],
    );
  }
}
