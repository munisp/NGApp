import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OtelCollectorScreen extends StatelessWidget {
  const OtelCollectorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'OTel Collector',
      apiEndpoint: '/api/production/otel-collector/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'OTEL_COLLECTOR_SCREEN-001', 'status': 'active'},
        {'id': 'OTEL_COLLECTOR_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
