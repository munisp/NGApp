import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TBPGSagaDefinitionsScreen extends StatelessWidget {
  const TBPGSagaDefinitionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Saga Definitions',
      apiEndpoint: '/api/platform/tb-pg-sync/sagas',
      columnKeys: const ['id', 'name', 'status', 'totalExecutions', 'successRate'],
      columnLabels: const ['ID', 'Name', 'Status', 'Executions', 'Success'],
      seedData: const [
              {'id': 'SAGA-001', 'name': 'Account Opening Saga', 'status': 'active', 'totalExecutions': '2800000', 'successRate': '0.9992'},
              {'id': 'SAGA-003', 'name': 'NIP Transfer Saga', 'status': 'active', 'totalExecutions': '45200000', 'successRate': '0.9997'},
      ],
    );
  }
}
