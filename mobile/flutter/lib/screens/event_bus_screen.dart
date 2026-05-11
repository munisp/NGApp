import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EventBusScreen extends StatelessWidget {
  const EventBusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Event Bus',
      apiEndpoint: '/api/events/v1/bus',
      columnKeys: const ['id', 'event', 'source', 'target', 'status'],
      columnLabels: const ['ID', 'Event', 'Source', 'Target', 'Status'],
      seedData: const [
      {'id': 'EVT-001', 'event': 'txn.created', 'source': 'Payments', 'target': 'Notifications', 'status': 'Delivered'},
    ],
    );
  }
}
