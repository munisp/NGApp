import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KafkaConsumerOptimizerScreen extends StatelessWidget {
  const KafkaConsumerOptimizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Kafka Consumer Optimizer',
      apiPath: '/api/performance/kafka-consumer/list',
      columnLabels: ["Group ID", "Topic", "Partitions"],
    );
  }
}
