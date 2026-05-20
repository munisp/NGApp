import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopSettlementModelsScreen extends StatelessWidget {
  const MojaloopSettlementModelsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Settlement Models',
      apiEndpoint: '/api/platform/mojaloop/settlement-models',
      columnKeys: const ['id', 'name', 'settlementGranularity', 'settlementDelay', 'currency'],
      columnLabels: const ['ID', 'Name', 'Granularity', 'Delay', 'Currency'],
      seedData: const [
              {'id': 'SM-001', 'name': 'Deferred Net Settlement', 'settlementGranularity': 'NET', 'settlementDelay': 'DEFERRED', 'currency': 'NGN'},
              {'id': 'SM-002', 'name': 'Real-Time Gross Settlement', 'settlementGranularity': 'GROSS', 'settlementDelay': 'IMMEDIATE', 'currency': 'NGN'},
      ],
    );
  }
}
