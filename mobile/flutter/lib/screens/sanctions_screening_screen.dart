import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SanctionsScreeningScreen extends StatelessWidget {
  const SanctionsScreeningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Sanctions Screening',
      apiEndpoint: '/api/kyc-enhanced/sanctions-lists',
      columnKeys: const ['id', 'name', 'source', 'entryCount', 'lastUpdated'],
      columnLabels: const ['ID', 'List', 'Source', 'Entries', 'Updated'],
      seedData: const [
        {'id': 'SANCTIONS_SCREENING-001', 'status': 'active'},
        {'id': 'SANCTIONS_SCREENING-002', 'status': 'pending'},
      ],
    );
  }
}
