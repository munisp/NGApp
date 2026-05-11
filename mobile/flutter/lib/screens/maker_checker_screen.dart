import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MakerCheckerScreen extends StatelessWidget {
  const MakerCheckerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Maker-Checker',
      apiEndpoint: '/api/maker-checker/v1/requests',
      columnKeys: const ['id', 'type', 'action', 'level', 'status'],
      columnLabels: const ['ID', 'Type', 'Action', 'Level', 'Status'],
      seedData: const [
      {'id': 'MC-001', 'type': 'Transfer', 'action': 'Approve', 'level': '2/3', 'status': 'Pending'},
    ],
    );
  }
}
