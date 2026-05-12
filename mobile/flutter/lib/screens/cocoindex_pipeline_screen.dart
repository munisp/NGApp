import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CocoindexPipelineScreen extends StatelessWidget {
  const CocoindexPipelineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CocoIndex Pipelines',
      apiEndpoint: '/api/ai-ml/cocoindex/pipelines',
      columnKeys: const ['id', 'name', 'source', 'sink', 'status', 'indexedDocs'],
      columnLabels: const ['ID', 'Pipeline', 'Source', 'Sink', 'Status', 'Indexed'],
      seedData: const [
        {'id': 'COCOINDEX_PIPELINE-001', 'status': 'active'},
        {'id': 'COCOINDEX_PIPELINE-002', 'status': 'pending'},
      ],
    );
  }
}
