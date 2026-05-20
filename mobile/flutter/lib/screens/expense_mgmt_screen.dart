import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ExpenseMgmtScreen extends StatelessWidget {
  const ExpenseMgmtScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Expense Management',
      apiEndpoint: '/api/expenses/v1/claims',
      columnKeys: const ['id', 'employee', 'amount', 'category', 'status'],
      columnLabels: const ['ID', 'Employee', 'Amount', 'Category', 'Status'],
      seedData: const [
      {'id': 'EXP-001', 'employee': 'Adebayo Admin', 'amount': 'NGN 150,000', 'category': 'Travel', 'status': 'Approved'},
    ],
    );
  }
}
