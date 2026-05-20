import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PerformanceCacheScreen extends StatelessWidget {
  const PerformanceCacheScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Performance Cache',
      apiEndpoint: '/api/platform/performance/cache',
      columnKeys: const ['key', 'endpoint', 'hitRate', 'size', 'encoding'],
      columnLabels: const ['Key', 'Endpoint', 'Hit Rate', 'Size', 'Encoding'],
      seedData: const [
              {'key': 'cache:dashboard:overview', 'endpoint': '/api/dashboard/overview', 'hitRate': '96.5%', 'size': '4.2KB', 'encoding': 'brotli'},
              {'key': 'cache:feature-flags', 'endpoint': '/api/feature-flags', 'hitRate': '99.6%', 'size': '8.5KB', 'encoding': 'brotli'},
      ],
    );
  }
}
