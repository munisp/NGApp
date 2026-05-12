import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RedisSessionStoreScreen extends StatelessWidget {
  const RedisSessionStoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Redis Session Store',
      apiPath: '/api/performance/redis-session/list',
      columnLabels: ["Session ID", "User ID", "Device"],
    );
  }
}
