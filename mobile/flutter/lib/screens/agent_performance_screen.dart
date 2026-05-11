import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgentPerformanceScreen extends StatelessWidget {
  const AgentPerformanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agent Performance',
      apiEndpoint: '/api/agent/v1/performance',
      columnKeys: const ['agent', 'volume', 'revenue', 'rating'],
      columnLabels: const ['Agent', 'Volume', 'Revenue', 'Rating'],
      seedData: const [
      {'agent': 'Mama Titi Stores', 'volume': 'NGN 2.5M', 'revenue': 'NGN 25,000', 'rating': '4.8'},
    ],
    );
  }
}
