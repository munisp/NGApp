import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ChangelogGeneratorScreen extends StatelessWidget {
  const ChangelogGeneratorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Changelog Generator',
      apiEndpoint: '/api/production/changelog/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'CHANGELOG_GENERATOR_SCREEN-001', 'status': 'active'},
        {'id': 'CHANGELOG_GENERATOR_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
