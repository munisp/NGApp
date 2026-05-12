import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DeveloperPortalScreen extends StatelessWidget {
  const DeveloperPortalScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Developer Portal',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'DEVELOPER_PORTAL_SCREEN-001', 'status': 'active'},
        {'id': 'DEVELOPER_PORTAL_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
