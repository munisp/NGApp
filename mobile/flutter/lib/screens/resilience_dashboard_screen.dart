import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ResilienceDashboardScreen extends StatelessWidget {
  const ResilienceDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Resilience Dashboard',
      apiEndpoint: '/api/resilience/dashboard',
      columnKeys: const ['channel', 'status', 'users', 'latency'],
      columnLabels: const ['Channel', 'Status', 'Users', 'Latency'],
      seedData: const [
      {'channel': 'Web App', 'status': 'online', 'users': '45,000', 'latency': '120ms'},
      {'channel': 'Mobile App', 'status': 'online', 'users': '89,000', 'latency': '180ms'},
      {'channel': 'USSD', 'status': 'online', 'users': '12,450', 'latency': '800ms'},
      {'channel': 'SMS Banking', 'status': 'online', 'users': '4,500', 'latency': '2s'},
      {'channel': 'Agent POS', 'status': 'online', 'users': '1,200', 'latency': '250ms'},
    ],
    );
  }
}
