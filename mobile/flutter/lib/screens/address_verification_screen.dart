import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AddressVerificationScreen extends StatelessWidget {
  const AddressVerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Address Verification',
      apiEndpoint: '/api/kyc-enhanced/address-verifications',
      columnKeys: const ['id', 'customerId', 'address', 'matchScore', 'method', 'status'],
      columnLabels: const ['ID', 'Customer', 'Address', 'Score', 'Method', 'Status'],
      seedData: const [
        {'id': 'ADDRESS_VERIFICATION-001', 'status': 'active'},
        {'id': 'ADDRESS_VERIFICATION-002', 'status': 'pending'},
      ],
    );
  }
}
