import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OtelConfigsScreen extends StatelessWidget {
  const OtelConfigsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'OpenTelemetry',
      apiEndpoint: '/api/platform/observability/otel-configs',
      columnKeys: const ['serviceName', 'exporter', 'samplingRate', 'status'],
      columnLabels: const ['Service', 'Exporter', 'Rate', 'Status'],
      seedData: const [
              {'serviceName': 'express-bff', 'exporter': 'otlp', 'samplingRate': '0.1', 'status': 'active'},
      ],
    );
  }
}
