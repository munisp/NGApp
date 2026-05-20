import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RedisCacheMiddlewareScreen extends StatelessWidget {
  const RedisCacheMiddlewareScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Redis Response Cache',
      apiPath: '/api/performance/redis-cache/list',
      columnLabels: ["Route", "TTL (s)", "Hit Rate"],
    );
  }
}
