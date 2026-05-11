import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ErpNextScreen extends StatelessWidget {
  const ErpNextScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ERP Integration',
      apiEndpoint: '/api/erp/v1/modules',
      columnKeys: const ['id', 'module', 'direction', 'lastSync', 'status'],
      columnLabels: const ['ID', 'Module', 'Direction', 'Last Sync', 'Status'],
      seedData: const [
      {'id': 'ERP-001', 'module': 'Accounts Payable', 'direction': 'Bidirectional', 'lastSync': '2026-05-09 14:00', 'status': 'Synced'},
    ],
    );
  }
}
