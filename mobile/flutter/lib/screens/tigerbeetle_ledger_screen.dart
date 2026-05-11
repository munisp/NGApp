import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TigerbeetleLedgerScreen extends StatelessWidget {
  const TigerbeetleLedgerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TigerBeetle Ledger',
      apiEndpoint: '/api/tigerbeetle/v1/accounts',
      columnKeys: const ['id', 'description', 'ledger', 'balance'],
      columnLabels: const ['ID', 'Description', 'Ledger', 'Balance'],
      seedData: const [
      {'id': 'TB-001', 'description': 'NGN Operating', 'ledger': 'ngn_operating', 'balance': 'NGN 450B'},
    ],
    );
  }
}
