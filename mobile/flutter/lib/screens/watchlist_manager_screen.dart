import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WatchlistManagerScreen extends StatelessWidget {
  const WatchlistManagerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Global Watchlist Manager',
      apiPath: '/api/aml-enhancement/watchlist-manager/list',
      columnLabels: ["List Name", "Source", "Entries"],
    );
  }
}
