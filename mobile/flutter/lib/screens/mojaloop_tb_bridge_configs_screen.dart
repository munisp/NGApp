import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopTBBridgeConfigsScreen extends StatelessWidget {
  const MojaloopTBBridgeConfigsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TB Bridge Configs',
      apiEndpoint: '/api/platform/mojaloop/tb-bridge/configs',
      columnKeys: const ['id', 'name', 'transferType', 'ledger', 'autoPost'],
      columnLabels: const ['ID', 'Name', 'Type', 'Ledger', 'Auto-Post'],
      seedData: const [
              {'id': 'TBC-001', 'name': 'Domestic Transfer Bridge', 'transferType': 'domestic_nip', 'ledger': '4', 'autoPost': 'true'},
              {'id': 'TBC-002', 'name': 'Cross-Border Transfer Bridge', 'transferType': 'cross_border', 'ledger': '5', 'autoPost': 'true'},
      ],
    );
  }
}
