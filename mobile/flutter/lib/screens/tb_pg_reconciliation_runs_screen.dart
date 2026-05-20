import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGReconciliationRunsScreen extends StatelessWidget {
  const TBPGReconciliationRunsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Reconciliation Runs',
      apiEndpoint: '/api/platform/tb-pg-sync/reconciliation/runs',
      columnKeys: const ['id', 'type', 'scope', 'status', 'accountsChecked', 'mismatchedAccounts'],
      columnLabels: const ['ID', 'Type', 'Scope', 'Status', 'Checked', 'Mismatches'],
      seedData: const [
              {'id': 'RECON-001', 'type': 'eod', 'scope': 'All customer accounts', 'status': 'completed', 'accountsChecked': '2500000', 'mismatchedAccounts': '0'},
              {'id': 'RECON-004', 'type': 'eod', 'scope': 'Loan portfolio', 'status': 'mismatches_found', 'accountsChecked': '320000', 'mismatchedAccounts': '3'},
      ],
    );
  }
}
