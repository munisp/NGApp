import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StandingInstructionsScreen extends StatelessWidget {
  const StandingInstructionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Standing Instructions',
      apiEndpoint: '/api/standing-instructions/v1/rules',
      columnKeys: const ['id', 'customer', 'type', 'trigger', 'status'],
      columnLabels: const ['ID', 'Customer', 'Type', 'Trigger', 'Status'],
      seedData: const [
      {'id': 'SI-001', 'customer': 'MTN Nigeria', 'type': 'Sweep', 'trigger': 'Balance > 10M', 'status': 'Active'},
    ],
    );
  }
}
