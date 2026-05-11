import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MicrofinanceScreen extends StatelessWidget {
  const MicrofinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Microfinance',
      apiEndpoint: '/api/microfinance/v1/groups',
      columnKeys: const ['id', 'name', 'members', 'model', 'repayment'],
      columnLabels: const ['ID', 'Group', 'Members', 'Model', 'Repayment'],
      seedData: const [
      {'id': 'MFI-001', 'name': 'Iya Oloja Women', 'members': '25', 'model': 'Solidarity', 'repayment': '98.5%'},
      {'id': 'MFI-002', 'name': 'Sabon Gari Farmers', 'members': '40', 'model': 'Village Banking', 'repayment': '96.2%'},
    ],
    );
  }
}
