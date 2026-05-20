import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TakafulManagementScreen extends StatelessWidget {
  const TakafulManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Takaful',
      apiEndpoint: '/api/islamic/v1/takaful',
      columnKeys: const ['id', 'name', 'type', 'contribution', 'status'],
      columnLabels: const ['ID', 'Plan', 'Type', 'Contribution', 'Status'],
      seedData: const [
      {'id': 'TAK-001', 'name': 'Family Takaful', 'type': 'Life', 'contribution': 'NGN 100,000/yr', 'status': 'Active'},
    ],
    );
  }
}
