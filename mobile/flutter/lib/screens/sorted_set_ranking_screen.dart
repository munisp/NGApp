import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SortedSetRankingScreen extends StatelessWidget {
  const SortedSetRankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Sorted Set Rankings',
      apiPath: '/api/performance/sorted-set-ranking/list',
      columnLabels: ["Name", "Members", "Top Score"],
    );
  }
}
