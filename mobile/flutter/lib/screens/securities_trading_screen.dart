import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SecuritiesTradingScreen extends StatelessWidget {
  const SecuritiesTradingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Securities Trading',
      apiEndpoint: '/api/securities/v1/orders',
      columnKeys: const ['id', 'security', 'exchange', 'side', 'qty', 'price', 'status'],
      columnLabels: const ['ID', 'Security', 'Exchange', 'Side', 'Qty', 'Price', 'Status'],
      seedData: const [
      {'id': 'ORD-001', 'security': 'DANGCEM', 'exchange': 'NGX', 'side': 'Buy', 'qty': '100,000', 'price': '290.50', 'status': 'Filled'},
      {'id': 'ORD-002', 'security': 'GTCO', 'exchange': 'NGX', 'side': 'Sell', 'qty': '50,000', 'price': '42.00', 'status': 'Filled'},
      {'id': 'ORD-003', 'security': 'MTNN', 'exchange': 'NGX', 'side': 'Buy', 'qty': '25,000', 'price': '215.00', 'status': 'Partial'},
    ],
    );
  }
}
