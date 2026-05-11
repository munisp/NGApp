import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ComplianceChecksScreen extends StatelessWidget {
  const ComplianceChecksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Compliance Checks',
      apiEndpoint: '/api/compliance/v1/checks',
      columnKeys: const ['id', 'regulation', 'area', 'status'],
      columnLabels: const ['ID', 'Regulation', 'Area', 'Status'],
      seedData: const [
      {'id': 'CMP-001', 'regulation': 'CBN Guidelines', 'area': 'Capital Adequacy', 'status': 'Compliant'},
      {'id': 'CMP-002', 'regulation': 'NDPR', 'area': 'Data Protection', 'status': 'Compliant'},
    ],
    );
  }
}
