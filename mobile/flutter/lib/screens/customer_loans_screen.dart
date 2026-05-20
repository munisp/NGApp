import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerLoansScreen extends StatelessWidget {
  const CustomerLoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Loans',
      apiEndpoint: '/api/loans/v1/customer',
      columnKeys: const ['id', 'product', 'outstanding', 'status'],
      columnLabels: const ['ID', 'Product', 'Outstanding', 'Status'],
      seedData: const [
      {'id': 'CL-001', 'product': 'Personal Loan', 'outstanding': 'NGN 1.5M', 'status': 'Performing'},
    ],
    );
  }
}
