import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UtilityPaymentsScreen extends StatelessWidget {
  const UtilityPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Utility Payments',
      apiEndpoint: '/api/bills/v1/utilities',
      columnKeys: const ['id', 'customer', 'biller', 'amount', 'status'],
      columnLabels: const ['ID', 'Customer', 'Biller', 'Amount', 'Status'],
      seedData: const [
      {'id': 'UTL-001', 'customer': 'Amina Bello', 'biller': 'Ikeja Electric', 'amount': 'NGN 15,000', 'status': 'Paid'},
      {'id': 'UTL-002', 'customer': 'Chidi Eze', 'biller': 'Lagos Water', 'amount': 'NGN 5,000', 'status': 'Paid'},
    ],
    );
  }
}
