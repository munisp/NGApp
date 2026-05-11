import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGReconciliationRulesScreen extends StatelessWidget {
  const TBPGReconciliationRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Reconciliation Rules',
      apiEndpoint: '/api/platform/tb-pg-sync/reconciliation/rules',
      columnKeys: const ['id', 'name', 'type', 'tolerance', 'frequency'],
      columnLabels: const ['ID', 'Name', 'Type', 'Tolerance', 'Frequency'],
      seedData: const [
              {'id': 'RRULE-001', 'name': 'Customer Balance Parity', 'type': 'balance_check', 'tolerance': '0', 'frequency': 'EOD 22:00'},
              {'id': 'RRULE-002', 'name': 'GL Trial Balance Zero-Sum', 'type': 'gl_balance', 'tolerance': '0', 'frequency': 'EOD 22:00'},
      ],
    );
  }
}
