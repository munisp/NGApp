import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WealthMgmtScreen extends StatelessWidget {
  const WealthMgmtScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Wealth Management',
      apiEndpoint: '/api/wealth/v1/portfolios',
      columnKeys: const ['id', 'client', 'aum', 'strategy', 'ytdReturn'],
      columnLabels: const ['ID', 'Client', 'AUM', 'Strategy', 'YTD'],
      seedData: const [
      {'id': 'WM-001', 'client': 'Otedola Family Office', 'aum': 'NGN 85B', 'strategy': 'Growth', 'ytdReturn': '+18.5%'},
      {'id': 'WM-002', 'client': 'Adenuga Trust', 'aum': 'NGN 120B', 'strategy': 'Balanced', 'ytdReturn': '+14.2%'},
    ],
    );
  }
}
