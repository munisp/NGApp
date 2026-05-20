import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApisixRoutesScreen extends StatelessWidget {
  const ApisixRoutesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'APISIX Routes',
      apiEndpoint: '/api/platform/apisix/routes',
      columnKeys: const ['name', 'uri', 'upstream', 'requestsPerSec', 'status'],
      columnLabels: const ['Name', 'URI', 'Upstream', 'RPS', 'Status'],
      seedData: const [
              {'name': 'Core Banking', 'uri': '/api/core-banking/*', 'upstream': 'core-banking-go', 'requestsPerSec': '2500', 'status': 'active'},
      ],
    );
  }
}
