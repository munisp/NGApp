import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EtdTradingScreen extends StatelessWidget {
  const EtdTradingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ETD Trading',
      apiEndpoint: '/api/etd/v1/contracts',
      columnKeys: const ['id', 'contract', 'type', 'qty', 'status'],
      columnLabels: const ['ID', 'Contract', 'Type', 'Qty', 'Status'],
      seedData: const [
      {'id': 'ETD-001', 'contract': 'NGX Futures Q3 2026', 'type': 'Equity Future', 'qty': '10,000', 'status': 'Open'},
    ],
    );
  }
}
