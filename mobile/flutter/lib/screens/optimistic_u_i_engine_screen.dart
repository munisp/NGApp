import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OptimisticUIEngineScreen extends StatelessWidget {
  const OptimisticUIEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Optimistic UI Engine',
      apiPath: '/api/performance/optimistic-ui/list',
      columnLabels: ["Action", "Endpoint", "Success Rate"],
    );
  }
}
