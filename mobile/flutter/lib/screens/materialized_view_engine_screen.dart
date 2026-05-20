import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MaterializedViewEngineScreen extends StatelessWidget {
  const MaterializedViewEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Materialized View Engine',
      apiPath: '/api/performance/materialized-views/list',
      columnLabels: ["View", "Refresh (s)", "Last Refresh (ms)"],
    );
  }
}
