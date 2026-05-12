import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ContractTestScreen extends StatelessWidget {
  const ContractTestScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Contract Tests',
      apiEndpoint: '/api/production/contract-tests/results',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'CONTRACT_TEST_SCREEN-001', 'status': 'active'},
        {'id': 'CONTRACT_TEST_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
