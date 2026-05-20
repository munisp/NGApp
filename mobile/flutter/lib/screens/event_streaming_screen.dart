import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EventStreamingScreen extends StatelessWidget {
  const EventStreamingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Event Streaming',
      apiEndpoint: '/api/events/v1/streams',
      columnKeys: const ['id', 'stream', 'throughput', 'lag', 'status'],
      columnLabels: const ['ID', 'Stream', 'Throughput', 'Lag', 'Status'],
      seedData: const [
      {'id': 'ES-001', 'stream': 'transactions', 'throughput': '10K/s', 'lag': '0ms', 'status': 'Active'},
    ],
    );
  }
}
