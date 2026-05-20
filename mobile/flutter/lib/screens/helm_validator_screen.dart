import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HelmValidatorScreen extends StatelessWidget {
  const HelmValidatorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Helm Validator',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'HELM_VALIDATOR_SCREEN-001', 'status': 'active'},
        {'id': 'HELM_VALIDATOR_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
