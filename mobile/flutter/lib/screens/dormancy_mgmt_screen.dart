import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DormancyMgmtScreen extends StatelessWidget {
  const DormancyMgmtScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Dormancy Management',
      apiEndpoint: '/api/accounts/v1/dormant',
      columnKeys: const ['account', 'customer', 'lastActivity', 'balance', 'status'],
      columnLabels: const ['Account', 'Customer', 'Last Activity', 'Balance', 'Status'],
      seedData: const [
      {'account': '0012345678', 'customer': 'Ibrahim Musa', 'lastActivity': '2024-06-15', 'balance': 'NGN 45,000', 'status': 'Dormant'},
      {'account': '0023456789', 'customer': 'Grace Obi', 'lastActivity': '2024-03-20', 'balance': 'NGN 12,500', 'status': 'Inoperative'},
    ],
    );
  }
}
