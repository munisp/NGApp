import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FeeSchedulesScreen extends StatelessWidget {
  const FeeSchedulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fee Schedules',
      apiEndpoint: '/api/fees/v1/schedules',
      columnKeys: const ['id', 'name', 'amount', 'type', 'status'],
      columnLabels: const ['ID', 'Fee', 'Amount', 'Type', 'Status'],
      seedData: const [
      {'id': 'FEE-001', 'name': 'Transfer < 5K', 'amount': 'NGN 10.75', 'type': 'Flat', 'status': 'Active'},
      {'id': 'FEE-002', 'name': 'Transfer 5K-50K', 'amount': 'NGN 26.88', 'type': 'Flat', 'status': 'Active'},
      {'id': 'FEE-003', 'name': 'Card Maintenance', 'amount': 'NGN 100/mo', 'type': 'Recurring', 'status': 'Active'},
    ],
    );
  }
}
