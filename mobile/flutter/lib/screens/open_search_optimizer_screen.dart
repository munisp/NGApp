import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OpenSearchOptimizerScreen extends StatelessWidget {
  const OpenSearchOptimizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'OpenSearch Optimizer',
      apiPath: '/api/performance/opensearch-optimizer/list',
      columnLabels: ["Index", "Shards", "Avg Query (ms)"],
    );
  }
}
