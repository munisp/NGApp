import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGSyncEventsScreen extends StatelessWidget {
  const TBPGSyncEventsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TB-PG Sync Events',
      apiEndpoint: '/api/platform/tb-pg-sync/events',
      columnKeys: const ['id', 'direction', 'eventType', 'status', 'latencyMs'],
      columnLabels: const ['ID', 'Direction', 'Type', 'Status', 'Latency'],
      seedData: const [
              {'id': 'EVT-001', 'direction': 'tb_to_pg', 'eventType': 'transfer_committed', 'status': 'synced', 'latencyMs': '3'},
              {'id': 'EVT-002', 'direction': 'pg_to_tb', 'eventType': 'account_created', 'status': 'synced', 'latencyMs': '8'},
      ],
    );
  }
}
