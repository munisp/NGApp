import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InfraRedisScreen extends StatelessWidget {
  const InfraRedisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Infra: Redis',
      apiEndpoint: '/api/infra/v1/redis',
      columnKeys: const ['id', 'instance', 'memory', 'keys', 'status'],
      columnLabels: const ['ID', 'Instance', 'Memory', 'Keys', 'Status'],
      seedData: const [
      {'id': 'RD-001', 'instance': 'redis-primary', 'memory': '4.2 GB', 'keys': '2.5M', 'status': 'Online'},
    ],
    );
  }
}
