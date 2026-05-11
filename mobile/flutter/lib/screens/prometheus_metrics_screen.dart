import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PrometheusMetricsScreen extends StatelessWidget {
  const PrometheusMetricsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Prometheus Metrics',
      apiEndpoint: '/api/platform/observability/prometheus-metrics',
      columnKeys: const ['name', 'type', 'category'],
      columnLabels: const ['Metric', 'Type', 'Category'],
      seedData: const [
              {'name': 'http_requests_total', 'type': 'counter', 'category': 'request'},
      ],
    );
  }
}
