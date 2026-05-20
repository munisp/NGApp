import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MandateManagementScreen extends StatelessWidget {
  const MandateManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Mandates',
      apiEndpoint: '/api/mandates/v1/list',
      columnKeys: const ['id', 'customer', 'type', 'status'],
      columnLabels: const ['ID', 'Customer', 'Type', 'Status'],
      seedData: const [
      {'id': 'MAN-001', 'customer': 'Dangote Group', 'type': 'Board Resolution', 'status': 'Verified'},
    ],
    );
  }
}
