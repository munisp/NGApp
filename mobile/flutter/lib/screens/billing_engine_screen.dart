import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BillingEngineScreen extends StatelessWidget {
  const BillingEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Billing Engine',
      apiEndpoint: '/api/billing/v1/invoices',
      columnKeys: const ['id', 'tenant', 'amount', 'period', 'status'],
      columnLabels: const ['ID', 'Tenant', 'Amount', 'Period', 'Status'],
      seedData: const [
      {'id': 'BIL-001', 'tenant': 'GTBank White Label', 'amount': 'NGN 15M', 'period': 'May 2026', 'status': 'Paid'},
    ],
    );
  }
}
