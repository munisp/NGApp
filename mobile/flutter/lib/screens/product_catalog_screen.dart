import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ProductCatalogScreen extends StatelessWidget {
  const ProductCatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Product Catalog',
      apiEndpoint: '/api/products/v1/catalog',
      columnKeys: const ['id', 'name', 'category', 'currency', 'status'],
      columnLabels: const ['ID', 'Product', 'Category', 'Ccy', 'Status'],
      seedData: const [
      {'id': 'PRD-001', 'name': 'Current Account', 'category': 'Deposits', 'currency': 'NGN', 'status': 'Active'},
      {'id': 'PRD-002', 'name': 'Term Loan', 'category': 'Lending', 'currency': 'NGN', 'status': 'Active'},
      {'id': 'PRD-003', 'name': 'Trade LC', 'category': 'Trade Finance', 'currency': 'USD', 'status': 'Active'},
    ],
    );
  }
}
