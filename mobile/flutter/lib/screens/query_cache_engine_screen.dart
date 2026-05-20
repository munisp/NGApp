import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class QueryCacheEngineScreen extends StatelessWidget {
  const QueryCacheEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Query Result Cache',
      apiPath: '/api/performance/query-cache/list',
      columnLabels: ["Query Hash", "Table", "Hit Rate"],
    );
  }
}
