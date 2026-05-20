import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InventoryFinanceScreen extends StatelessWidget {
  const InventoryFinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Inventory Finance',
      apiEndpoint: '/api/agri/v1/inventory',
      columnKeys: const ['id', 'borrower', 'commodity', 'value', 'status'],
      columnLabels: const ['ID', 'Borrower', 'Commodity', 'Value', 'Status'],
      seedData: const [
      {'id': 'INF-001', 'borrower': 'Olam Nigeria', 'commodity': 'Sesame Seeds', 'value': 'NGN 2B', 'status': 'Active'},
    ],
    );
  }
}
