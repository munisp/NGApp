import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ComponentMemoizerScreen extends StatelessWidget {
  const ComponentMemoizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Component Memoizer',
      apiPath: '/api/performance/component-memoizer/list',
      columnLabels: ["Component", "Rerenders/60s", "Saving"],
    );
  }
}
