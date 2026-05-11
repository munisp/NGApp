import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BrandedCommsScreen extends StatelessWidget {
  const BrandedCommsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Branded Comms',
      apiEndpoint: '/api/comms/v1/templates',
      columnKeys: const ['id', 'name', 'channel', 'status'],
      columnLabels: const ['ID', 'Template', 'Channel', 'Status'],
      seedData: const [
      {'id': 'BC-001', 'name': 'Welcome Email', 'channel': 'Email', 'status': 'Active'},
    ],
    );
  }
}
