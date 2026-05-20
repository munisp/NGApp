import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PensionScreen extends StatelessWidget {
  const PensionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Pension',
      apiEndpoint: '/api/pension/v1/schemes',
      columnKeys: const ['id', 'name', 'members', 'aum', 'status'],
      columnLabels: const ['ID', 'Scheme', 'Members', 'AUM', 'Status'],
      seedData: const [
      {'id': 'PEN-001', 'name': '54Bank Staff Pension', 'members': '2,500', 'aum': 'NGN 45B', 'status': 'Active'},
    ],
    );
  }
}
