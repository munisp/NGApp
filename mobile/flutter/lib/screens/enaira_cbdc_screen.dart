import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EnairaCbdcScreen extends StatelessWidget {
  const EnairaCbdcScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'eNaira CBDC',
      apiEndpoint: '/api/enaira/v1/wallets',
      columnKeys: const ['id', 'wallet', 'tier', 'balance', 'status'],
      columnLabels: const ['ID', 'Wallet', 'Tier', 'Balance', 'Status'],
      seedData: const [
      {'id': 'EN-001', 'wallet': 'eNGN-001-ABCD', 'tier': 'Tier 3', 'balance': 'eNGN 5,000,000', 'status': 'Active'},
    ],
    );
  }
}
