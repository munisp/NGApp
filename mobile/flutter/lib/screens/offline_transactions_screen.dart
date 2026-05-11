import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OfflineTransactionsScreen extends StatelessWidget {
  const OfflineTransactionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Offline Transactions',
      apiEndpoint: '/api/resilience/offline/transactions',
      columnKeys: const ['id', 'type', 'amount', 'status', 'deviceId'],
      columnLabels: const ['ID', 'Type', 'Amount', 'Status', 'Device'],
      seedData: const [
      {'id': 'OT-001', 'type': 'transfer', 'amount': 'NGN 15,000', 'status': 'queued', 'deviceId': 'DEV-AGENT-045'},
      {'id': 'OT-002', 'type': 'balance_check', 'amount': 'N/A', 'status': 'confirmed', 'deviceId': 'DEV-AGENT-045'},
      {'id': 'OT-003', 'type': 'bill_payment', 'amount': 'NGN 3,500', 'status': 'syncing', 'deviceId': 'DEV-AGENT-112'},
    ],
    );
  }
}
