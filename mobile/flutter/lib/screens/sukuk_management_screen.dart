import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SukukManagementScreen extends StatelessWidget {
  const SukukManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Sukuk Management',
      apiEndpoint: '/api/islamic/v1/sukuk',
      columnKeys: const ['id', 'name', 'type', 'amount', 'status'],
      columnLabels: const ['ID', 'Sukuk', 'Type', 'Amount', 'Status'],
      seedData: const [
      {'id': 'SUK-001', 'name': 'FGN Sukuk 2028', 'type': 'Ijara', 'amount': 'NGN 150B', 'status': 'Active'},
    ],
    );
  }
}
