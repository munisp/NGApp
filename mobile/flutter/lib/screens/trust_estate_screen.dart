import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TrustEstateScreen extends StatelessWidget {
  const TrustEstateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Trust & Estate',
      apiEndpoint: '/api/trust/v1/accounts',
      columnKeys: const ['id', 'name', 'type', 'value', 'status'],
      columnLabels: const ['ID', 'Trust', 'Type', 'Value', 'Status'],
      seedData: const [
      {'id': 'TR-001', 'name': 'Dangote Family Trust', 'type': 'Discretionary', 'value': 'NGN 500B', 'status': 'Active'},
    ],
    );
  }
}
