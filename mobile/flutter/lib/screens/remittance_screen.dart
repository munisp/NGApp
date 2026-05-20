import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RemittanceScreen extends StatelessWidget {
  const RemittanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Remittance',
      apiEndpoint: '/api/remittance/v1/transfers',
      columnKeys: const ['id', 'sender', 'receiver', 'amount', 'corridor'],
      columnLabels: const ['ID', 'Sender', 'Receiver', 'Amount', 'Corridor'],
      seedData: const [
      {'id': 'REM-001', 'sender': 'Emeka (London)', 'receiver': 'Chidinma (Lagos)', 'amount': 'GBP 500', 'corridor': 'UK-NG'},
      {'id': 'REM-002', 'sender': 'Fatima (Dubai)', 'receiver': 'Ibrahim (Kano)', 'amount': 'USD 1,000', 'corridor': 'UAE-NG'},
    ],
    );
  }
}
