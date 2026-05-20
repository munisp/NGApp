import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CacheInvalidationScreen extends StatelessWidget {
  const CacheInvalidationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cache Invalidation Engine',
      apiPath: '/api/performance/cache-invalidation/list',
      columnLabels: ["Channel", "Subscribers", "Invalidations 24h"],
    );
  }
}
