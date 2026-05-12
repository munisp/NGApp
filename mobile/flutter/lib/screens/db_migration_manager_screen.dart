import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DbMigrationManagerScreen extends StatelessWidget {
  const DbMigrationManagerScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'DB Migrations',
      apiEndpoint: '/api/production/db-migrations/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'DB_MIGRATION_MANAGER_SCREEN-001', 'status': 'active'},
        {'id': 'DB_MIGRATION_MANAGER_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
