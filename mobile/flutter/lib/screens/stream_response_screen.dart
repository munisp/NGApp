import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StreamResponseScreen extends StatelessWidget {
  const StreamResponseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Response Streamer',
      apiPath: '/api/performance/stream-response/list',
      columnLabels: ["Endpoint", "Threshold", "Streamed 24h"],
    );
  }
}
