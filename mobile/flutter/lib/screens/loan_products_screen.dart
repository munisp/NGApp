import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LoanProductsScreen extends StatelessWidget {
  const LoanProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Loan Products',
      apiEndpoint: '/api/loans/v1/products',
      columnKeys: const ['id', 'name', 'rate', 'maxTenor', 'status'],
      columnLabels: const ['ID', 'Product', 'Rate', 'Max Tenor', 'Status'],
      seedData: const [
      {'id': 'LP-001', 'name': 'Personal Loan', 'rate': '22%', 'maxTenor': '36 months', 'status': 'Active'},
      {'id': 'LP-002', 'name': 'SME Working Capital', 'rate': '18%', 'maxTenor': '12 months', 'status': 'Active'},
      {'id': 'LP-003', 'name': 'Mortgage', 'rate': '12%', 'maxTenor': '300 months', 'status': 'Active'},
    ],
    );
  }
}
