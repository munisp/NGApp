import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GRPCHotPathScreen extends StatelessWidget {
  const GRPCHotPathScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'gRPC Hot Path Gateway',
      apiPath: '/api/performance/grpc-hot-path/list',
      columnLabels: ["Service", "Latency (ms)", "Throughput RPS"],
    );
  }
}
