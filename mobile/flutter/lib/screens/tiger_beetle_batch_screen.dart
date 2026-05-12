import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TigerBeetleBatchScreen extends StatelessWidget {
  const TigerBeetleBatchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TigerBeetle Batch Engine',
      apiPath: '/api/performance/tb-batch/list',
      columnLabels: ["Batch Size", "Latency (ms)", "TPS"],
    );
  }
}
