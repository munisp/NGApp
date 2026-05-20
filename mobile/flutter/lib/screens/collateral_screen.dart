import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CollateralScreen extends StatelessWidget {
  const CollateralScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Collateral',
      apiEndpoint: '/api/collateral/v1/items',
      columnKeys: const ['id', 'type', 'description', 'value', 'status'],
      columnLabels: const ['ID', 'Type', 'Description', 'Value', 'Status'],
      seedData: const [
      {'id': 'COL-001', 'type': 'Real Estate', 'description': 'Banana Island Plot', 'value': 'NGN 2.5B', 'status': 'Verified'},
      {'id': 'COL-002', 'type': 'Equipment', 'description': 'Cement Plant Equipment', 'value': 'NGN 15B', 'status': 'Verified'},
    ],
    );
  }
}
