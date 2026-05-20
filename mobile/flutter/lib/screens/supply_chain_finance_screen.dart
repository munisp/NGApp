import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SupplyChainFinanceScreen extends StatelessWidget {
  const SupplyChainFinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Supply Chain Finance',
      apiEndpoint: '/api/scf/v1/programs',
      columnKeys: const ['id', 'anchor', 'suppliers', 'volume', 'status'],
      columnLabels: const ['ID', 'Anchor', 'Suppliers', 'Volume', 'Status'],
      seedData: const [
      {'id': 'SCF-001', 'anchor': 'Dangote Group', 'suppliers': '45', 'volume': 'NGN 25B', 'status': 'Active'},
    ],
    );
  }
}
