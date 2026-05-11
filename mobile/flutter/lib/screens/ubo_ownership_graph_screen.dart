import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UboOwnershipGraphScreen extends StatelessWidget {
  const UboOwnershipGraphScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'UBO Ownership Graph',
      apiEndpoint: '/api/kyc-enhanced/ubo-entities',
      columnKeys: const ['id', 'name', 'entityType', 'nationality', 'riskLevel'],
      columnLabels: const ['ID', 'Entity', 'Type', 'Nationality', 'Risk'],
      seedData: const [
        {'id': 'UBO_OWNERSHIP_GRAPH-001', 'status': 'active'},
        {'id': 'UBO_OWNERSHIP_GRAPH-002', 'status': 'pending'},
      ],
    );
  }
}
