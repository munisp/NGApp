import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ErrorTelemetryScreen extends StatelessWidget {
  const ErrorTelemetryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Error Telemetry',
      apiEndpoint: '/api/platform/error-telemetry',
      columnKeys: const ['period', 'errors', 'retries', 'successes', 'circuitBreaks'],
      columnLabels: const ['Period', 'Errors', 'Retries', 'Successes', 'CB Trips'],
      seedData: const [
              {'period': 'last_1h', 'errors': '42', 'retries': '56', 'successes': '49', 'circuitBreaks': '1'},
              {'period': 'last_24h', 'errors': '347', 'retries': '456', 'successes': '398', 'circuitBreaks': '3'},
      ],
    );
  }
}
