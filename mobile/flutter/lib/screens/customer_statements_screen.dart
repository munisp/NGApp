import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerStatementsScreen extends StatelessWidget {
  const CustomerStatementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Statements',
      apiEndpoint: '/api/statements/v1/customer',
      columnKeys: const ['period', 'format', 'status'],
      columnLabels: const ['Period', 'Format', 'Status'],
      seedData: const [
      {'period': 'May 2026', 'format': 'PDF', 'status': 'Available'},
      {'period': 'April 2026', 'format': 'PDF', 'status': 'Available'},
    ],
    );
  }
}
