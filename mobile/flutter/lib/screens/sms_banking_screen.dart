import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SmsBankingScreen extends StatelessWidget {
  const SmsBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SMS Banking',
      apiEndpoint: '/api/resilience/sms-banking/commands',
      columnKeys: const ['id', 'command', 'syntax', 'example'],
      columnLabels: const ['ID', 'Command', 'Syntax', 'Example'],
      seedData: const [
      {'id': 'SMS-001', 'command': 'BAL', 'syntax': 'BAL <PIN>', 'example': 'BAL 1234'},
      {'id': 'SMS-002', 'command': 'TRF', 'syntax': 'TRF <AMT> <ACCT> <BNK> <PIN>', 'example': 'TRF 5000 0123456789 GTB 1234'},
      {'id': 'SMS-003', 'command': 'AIR', 'syntax': 'AIR <AMT> <PHONE> <PIN>', 'example': 'AIR 1000 08012345678 1234'},
    ],
    );
  }
}
