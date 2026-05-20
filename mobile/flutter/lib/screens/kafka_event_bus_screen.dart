import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KafkaEventBusScreen extends StatelessWidget {
  const KafkaEventBusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Kafka Event Bus',
      apiEndpoint: '/api/kafka/v1/topics',
      columnKeys: const ['name', 'partitions', 'replication', 'consumers'],
      columnLabels: const ['Topic', 'Partitions', 'Replication', 'Consumers'],
      seedData: const [
      {'name': 'transactions.created', 'partitions': '12', 'replication': '3', 'consumers': '5'},
      {'name': 'audit.events', 'partitions': '6', 'replication': '3', 'consumers': '3'},
    ],
    );
  }
}
