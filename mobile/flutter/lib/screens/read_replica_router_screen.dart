import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ReadReplicaRouterScreen extends StatelessWidget {
  const ReadReplicaRouterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Read Replica Router',
      apiPath: '/api/performance/read-replica/list',
      columnLabels: ["Replica", "Lag (ms)", "Queries 24h"],
    );
  }
}
