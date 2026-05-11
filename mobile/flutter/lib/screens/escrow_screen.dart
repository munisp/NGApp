import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EscrowScreen extends StatelessWidget {
  const EscrowScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Escrow Services',
      apiEndpoint: '/api/escrow/v1/accounts',
      columnKeys: const ['id', 'parties', 'amount', 'purpose', 'status'],
      columnLabels: const ['ID', 'Parties', 'Amount', 'Purpose', 'Status'],
      seedData: const [
      {'id': 'ESC-001', 'parties': 'Dangote / BUA', 'amount': 'NGN 5B', 'purpose': 'Asset Acquisition', 'status': 'Held'},
    ],
    );
  }
}
