import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DdosProtectionScreen extends StatelessWidget {
  const DdosProtectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'DDoS Protection',
      apiEndpoint: '/api/ddos-protection/v1/ddos/rules',
      columnKeys: const ['id', 'name', 'type', 'action', 'status'],
      columnLabels: const ['ID', 'Rule', 'Type', 'Action', 'Status'],
      seedData: const [
      {'id': 'DDOS-001', 'name': 'Rate Limit API', 'type': 'L7', 'action': '1000/min', 'status': 'Active'},
    ],
    );
  }
}
