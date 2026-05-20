import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BiometricAuthScreen extends StatelessWidget {
  const BiometricAuthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Biometric Auth',
      apiEndpoint: '/api/kyc/v1/biometric',
      columnKeys: const ['id', 'customer', 'type', 'device', 'status'],
      columnLabels: const ['ID', 'Customer', 'Type', 'Device', 'Status'],
      seedData: const [
      {'id': 'BIO-001', 'customer': 'Amina Bello', 'type': 'Fingerprint', 'device': 'Samsung S24', 'status': 'Enrolled'},
    ],
    );
  }
}
