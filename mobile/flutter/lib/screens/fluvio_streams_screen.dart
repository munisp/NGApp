import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FluvioStreamsScreen extends StatelessWidget {
  const FluvioStreamsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fluvio Streams',
      apiEndpoint: '/api/fluvio/v1/topics',
      columnKeys: const ['id', 'topic', 'partitions', 'status'],
      columnLabels: const ['ID', 'Topic', 'Partitions', 'Status'],
      seedData: const [
      {'id': 'FLV-001', 'topic': 'audit-events', 'partitions': '6', 'status': 'Active'},
    ],
    );
  }
}
