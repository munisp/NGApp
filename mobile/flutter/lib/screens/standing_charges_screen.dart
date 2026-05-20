import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StandingChargesScreen extends StatelessWidget {
  const StandingChargesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Standing Charges',
      apiEndpoint: '/api/charges/v1/schedules',
      columnKeys: const ['id', 'name', 'amount', 'frequency'],
      columnLabels: const ['ID', 'Charge', 'Amount', 'Frequency'],
      seedData: const [
      {'id': 'SC-001', 'name': 'Account Maintenance', 'amount': 'NGN 50', 'frequency': 'Monthly'},
    ],
    );
  }
}
