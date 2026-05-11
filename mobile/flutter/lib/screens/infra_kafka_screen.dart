import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InfraKafkaScreen extends StatelessWidget {
  const InfraKafkaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Infra: Kafka',
      apiEndpoint: '/api/infra/v1/kafka',
      columnKeys: const ['id', 'broker', 'topics', 'status'],
      columnLabels: const ['ID', 'Broker', 'Topics', 'Status'],
      seedData: const [
      {'id': 'KFK-001', 'broker': 'kafka-0', 'topics': '24', 'status': 'Online'},
    ],
    );
  }
}
