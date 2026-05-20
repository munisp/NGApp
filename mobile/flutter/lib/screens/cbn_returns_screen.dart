import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CbnReturnsScreen extends StatelessWidget {
  const CbnReturnsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CBN Returns',
      apiEndpoint: '/api/cbn/v1/returns',
      columnKeys: const ['id', 'name', 'period', 'status'],
      columnLabels: const ['ID', 'Return', 'Period', 'Status'],
      seedData: const [
      {'id': 'CBN-001', 'name': 'Form A/B', 'period': 'May 2026', 'status': 'Submitted'},
    ],
    );
  }
}
