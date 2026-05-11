import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PepDatabaseScreen extends StatelessWidget {
  const PepDatabaseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PEP Database',
      apiEndpoint: '/api/pep/v1/entries',
      columnKeys: const ['id', 'name', 'position', 'risk'],
      columnLabels: const ['ID', 'Name', 'Position', 'Risk'],
      seedData: const [
      {'id': 'PEP-001', 'name': 'Gov. Sanwo-Olu', 'position': 'Governor, Lagos', 'risk': 'High'},
    ],
    );
  }
}
