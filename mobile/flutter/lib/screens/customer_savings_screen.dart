import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerSavingsScreen extends StatelessWidget {
  const CustomerSavingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Savings',
      apiEndpoint: '/api/savings/v1/customer',
      columnKeys: const ['id', 'product', 'balance', 'rate'],
      columnLabels: const ['ID', 'Product', 'Balance', 'Rate'],
      seedData: const [
      {'id': 'CS-001', 'product': '54Save Premium', 'balance': 'NGN 10,000,000', 'rate': '7.0%'},
    ],
    );
  }
}
