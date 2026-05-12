import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApiVersioningScreen extends StatelessWidget {
  const ApiVersioningScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'API Versioning',
      apiEndpoint: '/api/production/api-versioning/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'API_VERSIONING_SCREEN-001', 'status': 'active'},
        {'id': 'API_VERSIONING_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
