import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HotDataCacheScreen extends StatelessWidget {
  const HotDataCacheScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Hot Data Cache',
      apiPath: '/api/performance/hot-data-cache/list',
      columnLabels: ["Service", "Type", "Hit Rate"],
    );
  }
}
