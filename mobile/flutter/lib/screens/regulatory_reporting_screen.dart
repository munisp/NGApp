import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RegulatoryReportingScreen extends StatelessWidget {
  const RegulatoryReportingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Regulatory Reporting',
      apiEndpoint: '/api/regulatory/v1/returns',
      columnKeys: const ['id', 'name', 'regulator', 'frequency', 'status'],
      columnLabels: const ['ID', 'Return', 'Regulator', 'Freq', 'Status'],
      seedData: const [
      {'id': 'REG-001', 'name': 'eFASS Returns', 'regulator': 'CBN', 'frequency': 'Monthly', 'status': 'Submitted'},
      {'id': 'REG-002', 'name': 'NDIC Premium', 'regulator': 'NDIC', 'frequency': 'Quarterly', 'status': 'Due'},
    ],
    );
  }
}
