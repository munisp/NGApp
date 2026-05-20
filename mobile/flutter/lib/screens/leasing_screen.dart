import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LeasingScreen extends StatelessWidget {
  const LeasingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Leasing',
      apiEndpoint: '/api/leasing/v1/contracts',
      columnKeys: const ['id', 'lessee', 'asset', 'value', 'status'],
      columnLabels: const ['ID', 'Lessee', 'Asset', 'Value', 'Status'],
      seedData: const [
      {'id': 'LSE-001', 'lessee': 'Dangote Transport', 'asset': '50 Trucks', 'value': 'NGN 2.5B', 'status': 'Active'},
    ],
    );
  }
}
