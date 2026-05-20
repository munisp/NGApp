import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomDomainScreen extends StatelessWidget {
  const CustomDomainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Custom Domain',
      apiEndpoint: '/api/domains/v1/list',
      columnKeys: const ['id', 'domain', 'tenant', 'ssl', 'status'],
      columnLabels: const ['ID', 'Domain', 'Tenant', 'SSL', 'Status'],
      seedData: const [
      {'id': 'CD-001', 'domain': 'banking.gtbank.com', 'tenant': 'GTBank', 'ssl': 'Active', 'status': 'Verified'},
    ],
    );
  }
}
