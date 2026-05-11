import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WhiteLabelEngineScreen extends StatelessWidget {
  const WhiteLabelEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'White Label Engine',
      apiEndpoint: '/api/white-label/v1/engine',
      columnKeys: const ['id', 'partner', 'modules', 'users', 'status'],
      columnLabels: const ['ID', 'Partner', 'Modules', 'Users', 'Status'],
      seedData: const [
      {'id': 'WL-001', 'partner': 'Sterling MFB', 'modules': '12', 'users': '45,000', 'status': 'Active'},
      {'id': 'WL-002', 'partner': 'ALAT by Wema', 'modules': '18', 'users': '2.1M', 'status': 'Active'},
      {'id': 'WL-003', 'partner': 'LAPO Microfinance', 'modules': '8', 'users': '890,000', 'status': 'Active'},
      {'id': 'WL-004', 'partner': 'Kuda Digital', 'modules': '15', 'users': '5.2M', 'status': 'Onboarding'},
    ],
    );
  }
}
