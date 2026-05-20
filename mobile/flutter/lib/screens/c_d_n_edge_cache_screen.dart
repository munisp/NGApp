import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CDNEdgeCacheScreen extends StatelessWidget {
  const CDNEdgeCacheScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CDN Edge Cache',
      apiPath: '/api/performance/cdn-edge-cache/list',
      columnLabels: ["Provider", "Origin", "Static TTL"],
    );
  }
}
