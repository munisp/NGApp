import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGSagaExecutionsScreen extends StatelessWidget {
  const TBPGSagaExecutionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Saga Executions',
      apiEndpoint: '/api/platform/tb-pg-sync/saga-executions',
      columnKeys: const ['id', 'sagaName', 'status', 'currentStep', 'tenantId', 'durationMs'],
      columnLabels: const ['ID', 'Saga', 'Status', 'Step', 'Tenant', 'Duration'],
      seedData: const [
              {'id': 'SEXE-001', 'sagaName': 'NIP Transfer Saga', 'status': 'completed', 'currentStep': '4', 'tenantId': 'TEN-GTBANK', 'durationMs': '165'},
              {'id': 'SEXE-004', 'sagaName': 'Loan Disbursement Saga', 'status': 'compensating', 'currentStep': '2', 'tenantId': 'TEN-UBA', 'durationMs': '1450'},
      ],
    );
  }
}
