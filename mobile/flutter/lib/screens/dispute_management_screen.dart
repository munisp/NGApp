import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DisputeManagementScreen extends StatelessWidget {
  const DisputeManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Disputes',
      apiEndpoint: '/api/disputes/v1/cases',
      columnKeys: const ['id', 'customer', 'type', 'amount', 'status'],
      columnLabels: const ['ID', 'Customer', 'Type', 'Amount', 'Status'],
      seedData: const [
      {'id': 'DSP-001', 'customer': 'Amina Bello', 'type': 'Unauthorized POS', 'amount': 'NGN 45,000', 'status': 'Investigating'},
    ],
    );
  }
}
