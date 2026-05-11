import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TemporalSagasScreen extends StatelessWidget {
  const TemporalSagasScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Temporal Sagas',
      apiEndpoint: '/api/temporal/v1/sagas',
      columnKeys: const ['id', 'saga', 'steps', 'current', 'status'],
      columnLabels: const ['ID', 'Saga', 'Steps', 'Current', 'Status'],
      seedData: const [
      {'id': 'SAG-001', 'saga': 'LoanDisbursement', 'steps': '8', 'current': '5/8', 'status': 'Running'},
    ],
    );
  }
}
