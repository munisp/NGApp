import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KybEngineScreen extends StatelessWidget {
  const KybEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYB Engine',
      apiEndpoint: '/api/kyb/v1/verifications',
      columnKeys: const ['id', 'company', 'rcNo', 'status'],
      columnLabels: const ['ID', 'Company', 'RC Number', 'Status'],
      seedData: const [
      {'id': 'KYB-001', 'company': 'Dangote Industries', 'rcNo': 'RC 71463', 'status': 'Verified'},
    ],
    );
  }
}
