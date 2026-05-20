import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerSettingsScreen extends StatelessWidget {
  const CustomerSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Settings',
      apiEndpoint: '/api/settings/v1/customer',
      columnKeys: const ['setting', 'value', 'status'],
      columnLabels: const ['Setting', 'Value', 'Status'],
      seedData: const [
      {'setting': 'Transaction Alerts', 'value': 'SMS + Push', 'status': 'Enabled'},
      {'setting': 'Biometric Login', 'value': 'Fingerprint', 'status': 'Enabled'},
    ],
    );
  }
}
