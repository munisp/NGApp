import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FixedDepositsScreen extends StatelessWidget {
  const FixedDepositsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fixed Deposits',
      apiEndpoint: '/api/deposits/v1/fixed',
      columnKeys: const ['id', 'customer', 'principal', 'rate', 'maturity'],
      columnLabels: const ['ID', 'Customer', 'Principal', 'Rate', 'Maturity'],
      seedData: const [
      {'id': 'FD-001', 'customer': 'Chief Emeka Offor', 'principal': 'NGN 500M', 'rate': '14.5%', 'maturity': '2027-05-09'},
      {'id': 'FD-002', 'customer': 'Otedola Foundation', 'principal': 'NGN 1.2B', 'rate': '15.0%', 'maturity': '2026-11-05'},
    ],
    );
  }
}
