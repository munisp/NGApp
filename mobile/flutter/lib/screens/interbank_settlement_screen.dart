import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InterbankSettlementScreen extends StatelessWidget {
  const InterbankSettlementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Interbank Settlement',
      apiEndpoint: '/api/interbank/v1/settlements',
      columnKeys: const ['id', 'type', 'amount', 'channel', 'status'],
      columnLabels: const ['ID', 'Type', 'Amount', 'Channel', 'Status'],
      seedData: const [
      {'id': 'SET-001', 'type': 'NIBSS Instant', 'amount': 'NGN 5.2B', 'channel': 'NIBSS', 'status': 'Settled'},
    ],
    );
  }
}
