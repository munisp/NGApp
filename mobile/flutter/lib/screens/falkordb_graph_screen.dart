import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FalkordbGraphScreen extends StatelessWidget {
  const FalkordbGraphScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FalkorDB Graph Analytics',
      apiEndpoint: '/api/ai-ml/falkordb/cypher-queries',
      columnKeys: const ['id', 'name', 'cypher', 'avgMs'],
      columnLabels: const ['ID', 'Query', 'Cypher', 'Avg ms'],
      seedData: const [
        {'id': 'FALKORDB_GRAPH-001', 'status': 'active'},
        {'id': 'FALKORDB_GRAPH-002', 'status': 'pending'},
      ],
    );
  }
}
