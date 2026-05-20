import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PbacEngineScreen extends StatelessWidget {
  const PbacEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PBAC Engine',
      apiEndpoint: '/api/pbac-engine/v1/pbac/policies',
      columnKeys: const ['id', 'name', 'effect', 'scope', 'status'],
      columnLabels: const ['ID', 'Policy', 'Effect', 'Scope', 'Status'],
      seedData: const [
      {'id': 'PB-001', 'name': 'Admin Full Access', 'effect': 'Allow', 'scope': 'All', 'status': 'Active'},
    ],
    );
  }
}
