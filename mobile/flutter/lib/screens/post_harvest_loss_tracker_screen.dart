import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PostHarvestLossTrackerScreen extends StatelessWidget {
  const PostHarvestLossTrackerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Post-Harvest Loss',
      apiPath: '/api/agriculture-enhancement/post-harvest-loss-tracker/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
