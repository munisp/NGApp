import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DaprSidecarScreen extends StatelessWidget {
  const DaprSidecarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Dapr Sidecar',
      apiEndpoint: '/api/dapr/v1/sidecars',
      columnKeys: const ['id', 'app', 'port', 'status'],
      columnLabels: const ['ID', 'App', 'Port', 'Status'],
      seedData: const [
      {'id': 'DAPR-001', 'app': 'core-banking', 'port': '3500', 'status': 'Running'},
    ],
    );
  }
}
