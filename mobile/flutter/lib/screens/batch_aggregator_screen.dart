import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BatchAggregatorScreen extends StatelessWidget {
  const BatchAggregatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Batch Request Aggregator',
      apiPath: '/api/performance/batch-aggregator/list',
      columnLabels: ["Endpoint", "Max Requests", "Avg Batch"],
    );
  }
}
