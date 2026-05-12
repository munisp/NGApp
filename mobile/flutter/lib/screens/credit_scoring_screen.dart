import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CreditScoringScreen extends StatelessWidget {
  const CreditScoringScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Credit Scoring',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'CREDIT_SCORING_SCREEN-001', 'status': 'active'},
        {'id': 'CREDIT_SCORING_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
