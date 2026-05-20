import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LedgerSyncScreen extends StatelessWidget {
  const LedgerSyncScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Ledger Sync',
      apiEndpoint: '/api/ledger/v1/sync',
      columnKeys: const ['id', 'source', 'target', 'status'],
      columnLabels: const ['ID', 'Source', 'Target', 'Status'],
      seedData: const [
      {'id': 'LS-001', 'source': 'TigerBeetle', 'target': 'Postgres GL', 'status': 'Synced'},
    ],
    );
  }
}
