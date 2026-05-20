import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NotificationCenterScreen extends StatelessWidget {
  const NotificationCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Notification Center',
      apiEndpoint: '/api/platform/notifications',
      columnKeys: const ['id', 'type', 'channel', 'title', 'severity'],
      columnLabels: const ['ID', 'Type', 'Channel', 'Title', 'Severity'],
      seedData: const [
              {'id': 'NF-001', 'type': 'circuit_breaker_trip', 'channel': 'push', 'title': 'Circuit Breaker Tripped', 'severity': 'critical'},
              {'id': 'NF-002', 'type': 'error_spike', 'channel': 'in_app', 'title': 'Error Spike: 98 rate-limit hits', 'severity': 'warning'},
      ],
    );
  }
}
