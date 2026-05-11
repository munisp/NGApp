import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgentBankingScreen extends StatelessWidget {
  const AgentBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agent Banking',
      apiEndpoint: '/api/agent/v1/agents',
      columnKeys: const ['id', 'name', 'location', 'txns', 'status'],
      columnLabels: const ['ID', 'Agent', 'Location', 'Txns Today', 'Status'],
      seedData: const [
      {'id': 'AGT-001', 'name': 'Mama Titi Stores', 'location': 'Mushin, Lagos', 'txns': '85', 'status': 'Active'},
      {'id': 'AGT-002', 'name': 'Alhaji Musa POS', 'location': 'Sabon Gari, Kano', 'txns': '120', 'status': 'Active'},
    ],
    );
  }
}
