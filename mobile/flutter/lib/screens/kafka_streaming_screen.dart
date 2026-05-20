import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KafkaStreamingScreen extends StatelessWidget {
  const KafkaStreamingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Kafka Streaming',
      apiEndpoint: '/api/kafka/v1/streaming',
      columnKeys: const ['id', 'pipeline', 'throughput', 'status'],
      columnLabels: const ['ID', 'Pipeline', 'Throughput', 'Status'],
      seedData: const [
      {'id': 'KS-001', 'pipeline': 'txn-enrichment', 'throughput': '15K/s', 'status': 'Active'},
    ],
    );
  }
}
