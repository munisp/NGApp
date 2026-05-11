import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ChannelManagementScreen extends StatelessWidget {
  const ChannelManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Channel Management',
      apiEndpoint: '/api/channels/v1/list',
      columnKeys: const ['id', 'name', 'users', 'txns', 'status'],
      columnLabels: const ['ID', 'Channel', 'Users', 'Txns/Day', 'Status'],
      seedData: const [
      {'id': 'CH-001', 'name': 'Mobile App', 'users': '1.2M', 'txns': '450K', 'status': 'Online'},
      {'id': 'CH-002', 'name': 'USSD (*919#)', 'users': '3.5M', 'txns': '1.2M', 'status': 'Online'},
      {'id': 'CH-003', 'name': 'Internet Banking', 'users': '800K', 'txns': '120K', 'status': 'Online'},
    ],
    );
  }
}
