import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApisixUpstreamsScreen extends StatelessWidget {
  const ApisixUpstreamsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'APISIX Upstreams',
      apiEndpoint: '/api/platform/apisix/upstreams',
      columnKeys: const ['name', 'service', 'type', 'retries', 'status'],
      columnLabels: const ['Name', 'Service', 'LB', 'Retries', 'Status'],
      seedData: const [
              {'name': 'core-banking-go', 'service': 'core-banking-go', 'type': 'roundrobin', 'retries': '3', 'status': 'healthy'},
      ],
    );
  }
}
