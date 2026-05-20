import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BillingEventProcessorScreen extends StatelessWidget {
  const BillingEventProcessorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Billing Events',
      apiEndpoint: '/api/billing/v1/events',
      columnKeys: const ['id', 'event', 'amount', 'status'],
      columnLabels: const ['ID', 'Event', 'Amount', 'Status'],
      seedData: const [
      {'id': 'BE-001', 'event': 'Transaction Fee Collected', 'amount': 'NGN 10.75', 'status': 'Processed'},
    ],
    );
  }
}
