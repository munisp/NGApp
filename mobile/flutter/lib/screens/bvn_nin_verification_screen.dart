import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BvnNinVerificationScreen extends StatelessWidget {
  const BvnNinVerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'BVN/NIN Verification',
      apiEndpoint: '/api/kyc-enhanced/bvn-records',
      columnKeys: const ['id', 'bvn', 'firstName', 'lastName', 'dob', 'ninLinked', 'verified'],
      columnLabels: const ['ID', 'BVN', 'First Name', 'Last Name', 'DOB', 'NIN Linked', 'Verified'],
      seedData: const [
        {'id': 'BVN_NIN_VERIFICATION-001', 'status': 'active'},
        {'id': 'BVN_NIN_VERIFICATION-002', 'status': 'pending'},
      ],
    );
  }
}
