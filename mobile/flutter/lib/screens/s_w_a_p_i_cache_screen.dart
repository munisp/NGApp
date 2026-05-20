import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SWAPICacheScreen extends StatelessWidget {
  const SWAPICacheScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Service Worker API Cache',
      apiPath: '/api/performance/sw-api-cache/list',
      columnLabels: ["Pattern", "Strategy", "Max Age (s)"],
    );
  }
}
