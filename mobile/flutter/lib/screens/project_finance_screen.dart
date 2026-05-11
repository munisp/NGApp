import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ProjectFinanceScreen extends StatelessWidget {
  const ProjectFinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Project Finance',
      apiEndpoint: '/api/project-finance/v1/deals',
      columnKeys: const ['id', 'project', 'sponsor', 'amount', 'status'],
      columnLabels: const ['ID', 'Project', 'Sponsor', 'Amount', 'Status'],
      seedData: const [
      {'id': 'PF-001', 'project': 'Lekki Deep Sea Port', 'sponsor': 'Tolaram Group', 'amount': 'USD 1.5B', 'status': 'Active'},
    ],
    );
  }
}
