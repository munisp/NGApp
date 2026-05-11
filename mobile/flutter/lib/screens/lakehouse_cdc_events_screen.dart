import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseCDCEventsScreen extends StatelessWidget {
  const LakehouseCDCEventsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Lakehouse CDC Events',
      apiEndpoint: '/api/platform/lakehouse/cdc-events',
      columnKeys: const ['eventId', 'eventType', 'domain', 'service', 'table'],
      columnLabels: const ['ID', 'Type', 'Domain', 'Service', 'Table'],
      seedData: const [
              {'eventId': 'CDC-001', 'eventType': 'transfer_completed', 'domain': 'payments', 'service': 'payments-hub-go', 'table': 'payments_cdc'},
              {'eventId': 'CDC-002', 'eventType': 'loan_disbursed', 'domain': 'lending', 'service': 'lending-engine-go', 'table': 'loan_events'},
      ],
    );
  }
}
