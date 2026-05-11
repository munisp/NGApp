import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class IslamicBankingScreen extends StatelessWidget {
  const IslamicBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Islamic Banking',
      apiEndpoint: '/api/islamic/v1/products',
      columnKeys: const ['id', 'name', 'type', 'rate', 'status'],
      columnLabels: const ['ID', 'Product', 'Type', 'Profit Rate', 'Status'],
      seedData: const [
      {'id': 'ISL-001', 'name': 'Murabaha Home', 'type': 'Murabaha', 'rate': '12%', 'status': 'Active'},
      {'id': 'ISL-002', 'name': 'Ijara Equipment', 'type': 'Ijara', 'rate': '10%', 'status': 'Active'},
    ],
    );
  }
}
