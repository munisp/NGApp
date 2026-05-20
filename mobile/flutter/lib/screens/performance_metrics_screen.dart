import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PerformanceMetricsScreen extends StatelessWidget {
  const PerformanceMetricsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Performance Metrics',
      apiEndpoint: '/api/platform/performance/metrics',
      columnKeys: const ['endpoint', 'p50Ms', 'p99Ms', 'rps', 'compressionSaving'],
      columnLabels: const ['Endpoint', 'P50ms', 'P99ms', 'RPS', 'Savings'],
      seedData: const [
              {'endpoint': '/api/dashboard/overview', 'p50Ms': '12', 'p99Ms': '120', 'rps': '250', 'compressionSaving': '68.8%'},
              {'endpoint': '/api/payments/v1/transfers', 'p50Ms': '45', 'p99Ms': '450', 'rps': '320', 'compressionSaving': '60.0%'},
      ],
    );
  }
}
