import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopCallbacksScreen extends StatelessWidget {
  const MojaloopCallbacksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FSPIOP Callbacks',
      apiEndpoint: '/api/platform/mojaloop/callbacks',
      columnKeys: const ['id', 'type', 'resource', 'status', 'latencyMs'],
      columnLabels: const ['ID', 'Type', 'Resource', 'Status', 'Latency'],
      seedData: const [
              {'id': 'CB-001', 'type': 'PUT', 'resource': 'parties', 'status': 'processed', 'latencyMs': '50'},
              {'id': 'CB-003', 'type': 'PUT', 'resource': 'transfers', 'status': 'processed', 'latencyMs': '15'},
      ],
    );
  }
}
