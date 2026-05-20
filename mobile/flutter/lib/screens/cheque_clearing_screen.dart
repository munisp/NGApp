import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ChequeClearingScreen extends StatelessWidget {
  const ChequeClearingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cheque Clearing',
      apiEndpoint: '/api/cheques/v1/clearing',
      columnKeys: const ['id', 'drawer', 'amount', 'bank', 'status'],
      columnLabels: const ['ID', 'Drawer', 'Amount', 'Bank', 'Status'],
      seedData: const [
      {'id': 'CHQ-001', 'drawer': 'Dangote Industries', 'amount': 'NGN 50M', 'bank': 'First Bank', 'status': 'Cleared'},
    ],
    );
  }
}
