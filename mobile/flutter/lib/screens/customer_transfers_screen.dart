import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerTransfersScreen extends StatelessWidget {
  const CustomerTransfersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Transfers',
      apiEndpoint: '/api/transfers/v1/customer',
      columnKeys: const ['id', 'to', 'amount', 'date', 'status'],
      columnLabels: const ['ID', 'To', 'Amount', 'Date', 'Status'],
      seedData: const [
      {'id': 'CT-001', 'to': 'GTBank - 0123456789', 'amount': 'NGN 500,000', 'date': '2026-05-09', 'status': 'Completed'},
    ],
    );
  }
}
