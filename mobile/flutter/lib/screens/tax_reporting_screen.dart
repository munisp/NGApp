import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TaxReportingScreen extends StatelessWidget {
  const TaxReportingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Tax Reporting',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'TAX_REPORTING_SCREEN-001', 'status': 'active'},
        {'id': 'TAX_REPORTING_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
