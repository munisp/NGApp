import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ServiceRegistryScreen extends StatelessWidget {
  const ServiceRegistryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Service Registry',
      apiEndpoint: '/api/platform/service-mesh/registry',
      columnKeys: const ['name', 'language', 'port', 'status', 'responseTimeMs', 'circuitState'],
      columnLabels: const ['Service', 'Lang', 'Port', 'Status', 'ms', 'Circuit'],
      seedData: const [
              {'name': 'core-banking-go', 'language': 'go', 'port': '8100', 'status': 'healthy', 'responseTimeMs': '3', 'circuitState': 'closed'},
      ],
    );
  }
}
