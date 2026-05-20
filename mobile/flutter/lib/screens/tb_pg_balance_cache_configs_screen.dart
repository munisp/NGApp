import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGBalanceCacheConfigsScreen extends StatelessWidget {
  const TBPGBalanceCacheConfigsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Balance Cache Configs',
      apiEndpoint: '/api/platform/tb-pg-sync/balance-cache/configs',
      columnKeys: const ['id', 'name', 'ttlSeconds', 'hitRate', 'avgReadLatencyUs'],
      columnLabels: const ['ID', 'Name', 'TTL', 'Hit Rate', 'Read µs'],
      seedData: const [
              {'id': 'BCACHE-001', 'name': 'Customer Account Balances', 'ttlSeconds': '30', 'hitRate': '0.987', 'avgReadLatencyUs': '85'},
              {'id': 'BCACHE-004', 'name': 'FX Position Balances', 'ttlSeconds': '5', 'hitRate': '0.992', 'avgReadLatencyUs': '45'},
      ],
    );
  }
}
