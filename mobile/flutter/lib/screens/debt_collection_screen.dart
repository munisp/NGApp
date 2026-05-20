import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DebtCollectionScreen extends StatelessWidget {
  const DebtCollectionScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Debt Collection',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'DEBT_COLLECTION_SCREEN-001', 'status': 'active'},
        {'id': 'DEBT_COLLECTION_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
