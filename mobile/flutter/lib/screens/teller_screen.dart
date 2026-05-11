import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TellerScreen extends StatelessWidget {
  const TellerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Teller',
      apiEndpoint: '/api/teller/v1/sessions',
      columnKeys: const ['id', 'teller', 'branch', 'txns', 'status'],
      columnLabels: const ['ID', 'Teller', 'Branch', 'Txns Today', 'Status'],
      seedData: const [
      {'id': 'TLR-001', 'teller': 'Ngozi Okafor', 'branch': 'Marina HQ', 'txns': '45', 'status': 'Active'},
    ],
    );
  }
}
