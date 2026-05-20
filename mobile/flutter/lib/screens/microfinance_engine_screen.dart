import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MicrofinanceEngineScreen extends StatelessWidget {
  const MicrofinanceEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Microfinance Engine',
      apiEndpoint: '/api/microfinance-engine/v1/microfinance/groups',
      columnKeys: const ['id', 'group', 'savings', 'loans', 'status'],
      columnLabels: const ['ID', 'Group', 'Savings', 'Loans Active', 'Status'],
      seedData: const [
      {'id': 'MFE-001', 'group': 'Iya Oloja Women', 'savings': 'NGN 12.5M', 'loans': '15', 'status': 'Active'},
    ],
    );
  }
}
