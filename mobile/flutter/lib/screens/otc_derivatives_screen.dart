import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OtcDerivativesScreen extends StatelessWidget {
  const OtcDerivativesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'OTC Derivatives',
      apiEndpoint: '/api/otc/v1/deals',
      columnKeys: const ['id', 'type', 'counterparty', 'notional', 'status'],
      columnLabels: const ['ID', 'Type', 'Counterparty', 'Notional', 'Status'],
      seedData: const [
      {'id': 'OTC-001', 'type': 'IRS', 'counterparty': 'Access Bank', 'notional': 'NGN 10B', 'status': 'Active'},
    ],
    );
  }
}
