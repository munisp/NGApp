import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycAmlScreen extends StatelessWidget {
  const KycAmlScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC / AML',
      apiEndpoint: '/api/kyc/v1/screening',
      columnKeys: const ['id', 'name', 'type', 'risk', 'status'],
      columnLabels: const ['ID', 'Name', 'Type', 'Risk', 'Status'],
      seedData: const [
      {'id': 'KYC-001', 'name': 'Dangote Industries', 'type': 'Corporate', 'risk': 'Low', 'status': 'Verified'},
      {'id': 'KYC-002', 'name': 'Ibrahim Musa', 'type': 'Individual', 'risk': 'Medium', 'status': 'EDD'},
    ],
    );
  }
}
