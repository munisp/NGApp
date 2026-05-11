import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WatchlistScreen extends StatelessWidget {
  const WatchlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Watchlist / Sanctions',
      apiEndpoint: '/api/watchlist/v1/entries',
      columnKeys: const ['id', 'name', 'list', 'match', 'status'],
      columnLabels: const ['ID', 'Name', 'List', 'Match', 'Status'],
      seedData: const [
      {'id': 'WL-001', 'name': 'Test Sanctioned Entity', 'list': 'OFAC SDN', 'match': '95%', 'status': 'Blocked'},
    ],
    );
  }
}
