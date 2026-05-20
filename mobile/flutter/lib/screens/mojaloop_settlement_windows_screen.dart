import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopSettlementWindowsScreen extends StatelessWidget {
  const MojaloopSettlementWindowsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Settlement Windows',
      apiEndpoint: '/api/platform/mojaloop/settlement-windows',
      columnKeys: const ['id', 'state', 'transferCount', 'totalAmount', 'currency'],
      columnLabels: const ['ID', 'State', 'Transfers', 'Total', 'Currency'],
      seedData: const [
              {'id': 'SW-001', 'state': 'SETTLED', 'transferCount': '45200', 'totalAmount': '8945000000000', 'currency': 'NGN'},
              {'id': 'SW-003', 'state': 'OPEN', 'transferCount': '18500', 'totalAmount': '3200000000000', 'currency': 'NGN'},
      ],
    );
  }
}
