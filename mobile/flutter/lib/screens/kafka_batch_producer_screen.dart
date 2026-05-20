import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KafkaBatchProducerScreen extends StatelessWidget {
  const KafkaBatchProducerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Kafka Batch Producer',
      apiPath: '/api/performance/kafka-batch-producer/list',
      columnLabels: ["Topic", "Linger (ms)", "Throughput MPS"],
    );
  }
}
