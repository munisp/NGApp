import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class APISIXPluginOptimizerScreen extends StatelessWidget {
  const APISIXPluginOptimizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'APISIX Plugin Optimizer',
      apiPath: '/api/performance/apisix-plugin/list',
      columnLabels: ["Route", "Latency (ms)", "Saving"],
    );
  }
}
