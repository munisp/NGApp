import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CircuitBreakerDashboardScreen extends StatelessWidget {
  const CircuitBreakerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Circuit Breaker Dashboard',
      apiEndpoint: '/api/platform/circuit-breakers',
      columnKeys: const ['service', 'state', 'failureCount', 'successCount', 'fallbackStrategy', 'p50LatencyMs'],
      columnLabels: const ['Service', 'State', 'Failures', 'Successes', 'Fallback', 'P50ms'],
      seedData: const [
              {'service': 'core-banking-go', 'state': 'closed', 'failureCount': '0', 'successCount': '45200', 'fallbackStrategy': 'seed_data_fallback', 'p50LatencyMs': '45'},
              {'service': 'payments-hub-go', 'state': 'closed', 'failureCount': '1', 'successCount': '38100', 'fallbackStrategy': 'seed_data_fallback', 'p50LatencyMs': '52'},
              {'service': 'nibss-gateway-go', 'state': 'half_open', 'failureCount': '4', 'successCount': '2100', 'fallbackStrategy': 'queue_and_retry', 'p50LatencyMs': '200'},
      ],
    );
  }
}
