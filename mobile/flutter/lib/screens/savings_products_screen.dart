import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SavingsProductsScreen extends StatelessWidget {
  const SavingsProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Savings Products',
      apiEndpoint: '/api/products/v1/savings',
      columnKeys: const ['id', 'name', 'rate', 'minBalance', 'status'],
      columnLabels: const ['ID', 'Product', 'Rate', 'Min Balance', 'Status'],
      seedData: const [
      {'id': 'SAV-001', 'name': '54Save Regular', 'rate': '4.5%', 'minBalance': 'NGN 1,000', 'status': 'Active'},
      {'id': 'SAV-002', 'name': '54Save Premium', 'rate': '7.0%', 'minBalance': 'NGN 100,000', 'status': 'Active'},
      {'id': 'SAV-003', 'name': '54Save Kids', 'rate': '5.5%', 'minBalance': 'NGN 500', 'status': 'Active'},
      {'id': 'SAV-004', 'name': '54Save Target', 'rate': '10.0%', 'minBalance': 'NGN 5,000', 'status': 'Active'},
    ],
    );
  }
}
