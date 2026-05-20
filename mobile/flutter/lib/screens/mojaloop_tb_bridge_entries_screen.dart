import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopTBBridgeEntriesScreen extends StatelessWidget {
  const MojaloopTBBridgeEntriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TB Bridge Entries',
      apiEndpoint: '/api/platform/mojaloop/tb-bridge/entries',
      columnKeys: const ['id', 'direction', 'debitAccount', 'creditAccount', 'amount', 'status', 'latencyMs'],
      columnLabels: const ['ID', 'Direction', 'Debit', 'Credit', 'Amount', 'Status', 'Latency'],
      seedData: const [
              {'id': 'TBB-001', 'direction': 'outbound', 'debitAccount': 'TB:54BANK:POSITION', 'creditAccount': 'TB:GTBANK:POSITION', 'amount': '5000000', 'status': 'posted', 'latencyMs': '3'},
              {'id': 'TBB-004', 'direction': 'settlement', 'debitAccount': 'TB:GTBANK:SETTLEMENT', 'creditAccount': 'TB:54BANK:SETTLEMENT', 'amount': '125000000000', 'status': 'posted', 'latencyMs': '2'},
      ],
    );
  }
}
