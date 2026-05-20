import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TemporalMemoizerScreen extends StatelessWidget {
  const TemporalMemoizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Temporal Memoizer',
      apiPath: '/api/performance/temporal-memoizer/list',
      columnLabels: ["Workflow", "Activity", "Speedup"],
    );
  }
}
