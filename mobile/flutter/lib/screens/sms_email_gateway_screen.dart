import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SmsEmailGatewayScreen extends StatelessWidget {
  const SmsEmailGatewayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SMS/Email Gateway',
      apiEndpoint: '/api/gateway/v1/providers',
      columnKeys: const ['id', 'provider', 'type', 'status'],
      columnLabels: const ['ID', 'Provider', 'Type', 'Status'],
      seedData: const [
      {'id': 'GW-001', 'provider': 'Africa', 'type': 'SMS', 'status': 'Active'},
    ],
    );
  }
}
