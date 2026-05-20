import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PortfolioMgmtScreen extends StatelessWidget {
  const PortfolioMgmtScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Portfolio Management',
      apiEndpoint: '/api/wealth/v1/allocations',
      columnKeys: const ['asset', 'alloc', 'value', 'perf'],
      columnLabels: const ['Asset Class', 'Allocation', 'Value', 'Performance'],
      seedData: const [
      {'asset': 'Nigerian Equities', 'alloc': '35%', 'value': 'NGN 42B', 'perf': '+22.1%'},
      {'asset': 'FGN Bonds', 'alloc': '30%', 'value': 'NGN 36B', 'perf': '+8.5%'},
      {'asset': 'Eurobonds', 'alloc': '20%', 'value': 'NGN 24B', 'perf': '+12.3%'},
      {'asset': 'Money Market', 'alloc': '15%', 'value': 'NGN 18B', 'perf': '+5.2%'},
    ],
    );
  }
}
