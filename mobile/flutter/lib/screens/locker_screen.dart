import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LockerScreen extends StatelessWidget {
  const LockerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Locker Management',
      apiEndpoint: '/api/locker/v1/inventory',
      columnKeys: const ['id', 'branch', 'size', 'status'],
      columnLabels: const ['ID', 'Branch', 'Size', 'Status'],
      seedData: const [
      {'id': 'LCK-001', 'branch': 'Marina HQ', 'size': 'Large', 'status': 'Available'},
    ],
    );
  }
}
