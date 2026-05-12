import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VirtualScrollEngineScreen extends StatelessWidget {
  const VirtualScrollEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Virtual Scroll Engine',
      apiPath: '/api/performance/virtual-scroll/list',
      columnLabels: ["Table", "Total Rows", "Viewport"],
    );
  }
}
