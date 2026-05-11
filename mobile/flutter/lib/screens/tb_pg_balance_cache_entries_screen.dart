import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGBalanceCacheEntriesScreen extends StatelessWidget {
  const TBPGBalanceCacheEntriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Balance Cache Entries',
      apiEndpoint: '/api/platform/tb-pg-sync/balance-cache/entries',
      columnKeys: const ['accountId', 'accountName', 'availableBalance', 'currency', 'hitRate'],
      columnLabels: const ['Account', 'Name', 'Available', 'Currency', 'Hit Rate'],
      seedData: const [
              {'accountId': 'ACC-GTBANK-SAV-001', 'accountName': 'GTBank Savings Pool', 'availableBalance': '125000000000', 'currency': 'NGN', 'hitRate': '0.992'},
              {'accountId': 'FX-USD-TREASURY', 'accountName': 'USD Treasury Position', 'availableBalance': '25000000000', 'currency': 'USD', 'hitRate': '0.995'},
      ],
    );
  }
}
