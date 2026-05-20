import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FraudAlertsScreen extends StatelessWidget {
  const FraudAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fraud Alerts',
      apiEndpoint: '/api/fraud/v1/alerts',
      columnKeys: const ['id', 'type', 'amount', 'channel', 'status'],
      columnLabels: const ['ID', 'Type', 'Amount', 'Channel', 'Status'],
      seedData: const [
      {'id': 'FA-001', 'type': 'Card Not Present', 'amount': 'NGN 500,000', 'channel': 'Online', 'status': 'Blocked'},
    ],
    );
  }
}
