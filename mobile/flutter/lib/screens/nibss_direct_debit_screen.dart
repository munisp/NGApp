import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NibssDirectDebitScreen extends StatelessWidget {
  const NibssDirectDebitScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'NIBSS Direct Debit',
      apiEndpoint: '/api/nibss/v1/mandates',
      columnKeys: const ['id', 'payer', 'payee', 'amount', 'status'],
      columnLabels: const ['ID', 'Payer', 'Payee', 'Amount', 'Status'],
      seedData: const [
      {'id': 'NDD-001', 'payer': 'Emeka Nwankwo', 'payee': 'ARM Pension', 'amount': 'NGN 25,000', 'status': 'Active'},
    ],
    );
  }
}
