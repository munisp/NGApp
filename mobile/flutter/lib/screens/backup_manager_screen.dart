import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BackupManagerScreen extends StatelessWidget {
  const BackupManagerScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Backup Manager',
      apiEndpoint: '/api/production/backup-manager/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'BACKUP_MANAGER_SCREEN-001', 'status': 'active'},
        {'id': 'BACKUP_MANAGER_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
