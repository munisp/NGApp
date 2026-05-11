import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycEngineScreen extends StatelessWidget {
  const KycEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Engine',
      apiEndpoint: '/api/kyc/v1/verifications',
      columnKeys: const ['id', 'customer', 'idType', 'idNo', 'status'],
      columnLabels: const ['ID', 'Customer', 'ID Type', 'ID Number', 'Status'],
      seedData: const [
      {'id': 'VRF-001', 'customer': 'Adebayo Ogunlade', 'idType': 'NIN', 'idNo': '12345678901', 'status': 'Verified'},
      {'id': 'VRF-002', 'customer': 'Chidinma Okafor', 'idType': 'BVN', 'idNo': '22100567890', 'status': 'Verified'},
    ],
    );
  }
}
