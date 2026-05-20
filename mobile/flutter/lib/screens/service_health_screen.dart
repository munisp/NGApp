import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ServiceHealthScreen extends StatelessWidget {
  const ServiceHealthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Service Health',
      apiEndpoint: '/api/platform/services',
      columnKeys: const ['name', 'status', 'uptime', 'port'],
      columnLabels: const ['Service', 'Status', 'Uptime', 'Port'],
      seedData: const [
      {'name': 'Core Banking', 'status': 'Healthy', 'uptime': '99.99%', 'port': '8090'},
      {'name': 'Payments Hub', 'status': 'Healthy', 'uptime': '99.98%', 'port': '8091'},
      {'name': 'KYC Engine', 'status': 'Healthy', 'uptime': '99.97%', 'port': '8100'},
      {'name': 'Fraud Detection', 'status': 'Healthy', 'uptime': '99.99%', 'port': '8105'},
      {'name': 'Treasury', 'status': 'Healthy', 'uptime': '99.96%', 'port': '8110'},
    ],
    );
  }
}
