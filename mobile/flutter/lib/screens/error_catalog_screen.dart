import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ErrorCatalogScreen extends StatelessWidget {
  const ErrorCatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Error Catalog',
      apiEndpoint: '/api/platform/errors/catalog',
      columnKeys: const ['id', 'code', 'domain', 'severity', 'category', 'httpStatus'],
      columnLabels: const ['ID', 'Code', 'Domain', 'Severity', 'Category', 'HTTP'],
      seedData: const [
              {'id': 'E-001', 'code': 'AUTH_001', 'domain': 'authentication', 'severity': 'error', 'category': 'permanent', 'httpStatus': '401'},
              {'id': 'E-003', 'code': 'TXN_002', 'domain': 'transactions', 'severity': 'critical', 'category': 'transient', 'httpStatus': '504'},
      ],
    );
  }
}
