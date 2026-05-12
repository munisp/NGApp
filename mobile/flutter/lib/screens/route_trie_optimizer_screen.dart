import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RouteTrieOptimizerScreen extends StatelessWidget {
  const RouteTrieOptimizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Route Trie Optimizer',
      apiPath: '/api/performance/route-trie/list',
      columnLabels: ["Prefix", "Routes", "Lookup (ns)"],
    );
  }
}
