import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BloomFilterCacheScreen extends StatelessWidget {
  const BloomFilterCacheScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Bloom Filter Cache',
      apiPath: '/api/performance/bloom-filter/list',
      columnLabels: ["Name", "Capacity", "FP Rate"],
    );
  }
}
