import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MultiEntityScreen extends StatelessWidget {
  const MultiEntityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Multi-Entity',
      apiEndpoint: '/api/entities/v1/list',
      columnKeys: const ['id', 'entity', 'type', 'country', 'status'],
      columnLabels: const ['ID', 'Entity', 'Type', 'Country', 'Status'],
      seedData: const [
      {'id': 'ENT-001', 'entity': '54Bank Nigeria', 'type': 'Commercial Bank', 'country': 'Nigeria', 'status': 'Active'},
    ],
    );
  }
}
