import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InventoryScreen extends StatelessWidget {
  const InventoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Inventory Management',
      apiEndpoint: '/api/inventory/v1/items',
      columnKeys: const ['id', 'item', 'category', 'qty', 'location'],
      columnLabels: const ['ID', 'Item', 'Category', 'Quantity', 'Location'],
      seedData: const [
      {'id': 'INV-001', 'item': 'Verve Debit Cards', 'category': 'Cards', 'qty': '25,000', 'location': 'Lagos Vault'},
      {'id': 'INV-002', 'item': 'Token Devices', 'category': 'Security', 'qty': '5,000', 'location': 'Abuja Warehouse'},
      {'id': 'INV-003', 'item': 'Cheque Books', 'category': 'Stationery', 'qty': '12,000', 'location': 'Kano Branch'},
      {'id': 'INV-004', 'item': 'POS Terminals', 'category': 'Equipment', 'qty': '3,500', 'location': 'National Distribution'},
    ],
    );
  }
}
