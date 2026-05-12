import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InterestComputationScreen extends StatelessWidget {
  const InterestComputationScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Interest Computation',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'INTEREST_COMPUTATION_SCREEN-001', 'status': 'active'},
        {'id': 'INTEREST_COMPUTATION_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
