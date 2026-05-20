import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HAServicesScreen extends StatelessWidget {
  const HAServicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'HA Services',
      apiEndpoint: '/api/platform/ha/services',
      columnKeys: const ['service', 'replicas', 'status', 'failoverStrategy', 'uptime', 'loadBalancer'],
      columnLabels: const ['Service', 'Replicas', 'Status', 'Failover', 'Uptime', 'LB'],
      seedData: const [
              {'service': 'core-banking-go', 'replicas': '5', 'status': 'healthy', 'failoverStrategy': 'active-active', 'uptime': '99.99%', 'loadBalancer': 'round-robin'},
              {'service': 'tigerbeetle-adapter-rs', 'replicas': '3', 'status': 'healthy', 'failoverStrategy': 'active-passive', 'uptime': '99.999%', 'loadBalancer': 'primary-backup'},
      ],
    );
  }
}
