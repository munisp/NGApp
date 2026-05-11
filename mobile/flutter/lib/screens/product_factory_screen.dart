import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ProductFactoryScreen extends StatelessWidget {
  const ProductFactoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Product Factory',
      apiEndpoint: '/api/products/v1/factory',
      columnKeys: const ['id', 'product', 'type', 'rate', 'status'],
      columnLabels: const ['ID', 'Product', 'Type', 'Rate', 'Status'],
      seedData: const [
      {'id': 'PF-001', 'product': 'SME Working Capital', 'type': 'Loan', 'rate': '18.5%', 'status': 'Active'},
      {'id': 'PF-002', 'product': '54Save Premium', 'type': 'Savings', 'rate': '7.0%', 'status': 'Active'},
      {'id': 'PF-003', 'product': 'Diaspora FX Account', 'type': 'Current', 'rate': '0%', 'status': 'Draft'},
      {'id': 'PF-004', 'product': 'Green Energy Loan', 'type': 'Loan', 'rate': '12.0%', 'status': 'Pending Approval'},
    ],
    );
  }
}
