import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BundleSplitterScreen extends StatelessWidget {
  const BundleSplitterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Bundle Splitter',
      apiPath: '/api/performance/bundle-splitter/list',
      columnLabels: ["Chunk", "Routes", "Size KB"],
    );
  }
}
