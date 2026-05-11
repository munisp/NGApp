import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycOverridesScreen extends StatelessWidget {
  const KycOverridesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Overrides',
      apiEndpoint: '/api/kyc/v1/overrides',
      columnKeys: const ['id', 'customer', 'field', 'reason', 'status'],
      columnLabels: const ['ID', 'Customer', 'Field', 'Reason', 'Status'],
      seedData: const [
      {'id': 'KO-001', 'customer': 'Chief Emeka Offor', 'field': 'Risk Level', 'reason': 'Board Override', 'status': 'Approved'},
    ],
    );
  }
}
