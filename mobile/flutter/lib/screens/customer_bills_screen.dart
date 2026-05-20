import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerBillsScreen extends StatelessWidget {
  const CustomerBillsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Bills',
      apiEndpoint: '/api/bills/v1/customer',
      columnKeys: const ['id', 'biller', 'amount', 'due', 'status'],
      columnLabels: const ['ID', 'Biller', 'Amount', 'Due Date', 'Status'],
      seedData: const [
      {'id': 'CB-001', 'biller': 'Ikeja Electric', 'amount': 'NGN 15,000', 'due': '2026-05-15', 'status': 'Pending'},
    ],
    );
  }
}
