import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InsuranceScreen extends StatelessWidget {
  const InsuranceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Insurance',
      apiEndpoint: '/api/insurance/v1/policies',
      columnKeys: const ['id', 'holder', 'type', 'premium', 'status'],
      columnLabels: const ['ID', 'Holder', 'Type', 'Premium', 'Status'],
      seedData: const [
      {'id': 'INS-001', 'holder': 'Dangote Industries', 'type': 'Fire & Burglary', 'premium': 'NGN 250M/yr', 'status': 'Active'},
    ],
    );
  }
}
