import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopScreen extends StatelessWidget {
  const MojaloopScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Mojaloop',
      apiEndpoint: '/api/mojaloop/v1/transfers',
      columnKeys: const ['id', 'participant', 'type', 'amount', 'status'],
      columnLabels: const ['ID', 'Participant', 'Type', 'Amount', 'Status'],
      seedData: const [
      {'id': 'MOJ-001', 'participant': '54Bank', 'type': 'P2P Transfer', 'amount': 'NGN 50,000', 'status': 'Committed'},
    ],
    );
  }
}
