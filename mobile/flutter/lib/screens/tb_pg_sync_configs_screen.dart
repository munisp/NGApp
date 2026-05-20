import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGSyncConfigsScreen extends StatelessWidget {
  const TBPGSyncConfigsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TB-PG Sync Configs',
      apiEndpoint: '/api/platform/tb-pg-sync/configs',
      columnKeys: const ['id', 'name', 'direction', 'status', 'eventsProcessed'],
      columnLabels: const ['ID', 'Name', 'Direction', 'Status', 'Events'],
      seedData: const [
              {'id': 'SYNC-001', 'name': 'Account Balances → Postgres', 'direction': 'tb_to_pg', 'status': 'active', 'eventsProcessed': '45200000'},
              {'id': 'SYNC-002', 'name': 'New Accounts → TigerBeetle', 'direction': 'pg_to_tb', 'status': 'active', 'eventsProcessed': '2800000'},
              {'id': 'SYNC-003', 'name': 'Loan Disbursements → TigerBeetle', 'direction': 'pg_to_tb', 'status': 'active', 'eventsProcessed': '850000'},
      ],
    );
  }
}
