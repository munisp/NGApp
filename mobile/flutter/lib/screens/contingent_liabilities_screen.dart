import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ContingentLiabilitiesScreen extends StatelessWidget {
  const ContingentLiabilitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Contingent Liabilities',
      apiEndpoint: '/api/risk/v1/contingent',
      columnKeys: const ['id', 'type', 'amount', 'probability', 'status'],
      columnLabels: const ['ID', 'Type', 'Amount', 'Probability', 'Status'],
      seedData: const [
      {'id': 'CL-001', 'type': 'Legal Claim', 'amount': 'NGN 500M', 'probability': 'Possible', 'status': 'Disclosed'},
    ],
    );
  }
}
