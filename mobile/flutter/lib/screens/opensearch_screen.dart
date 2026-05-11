import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OpensearchScreen extends StatelessWidget {
  const OpensearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'OpenSearch',
      apiEndpoint: '/api/opensearch/v1/clusters',
      columnKeys: const ['id', 'cluster', 'nodes', 'indices', 'status'],
      columnLabels: const ['ID', 'Cluster', 'Nodes', 'Indices', 'Status'],
      seedData: const [
      {'id': 'OSC-001', 'cluster': '54bank-logs', 'nodes': '3', 'indices': '15', 'status': 'Green'},
    ],
    );
  }
}
