import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PaymentInvestigationScreen extends StatelessWidget {
  const PaymentInvestigationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Payment Investigation',
      apiEndpoint: '/api/payments/v1/investigations',
      columnKeys: const ['id', 'ref', 'amount', 'reason', 'status'],
      columnLabels: const ['ID', 'Reference', 'Amount', 'Reason', 'Status'],
      seedData: const [
      {'id': 'INV-001', 'ref': 'PAY-003', 'amount': 'NGN 45B', 'reason': 'Delayed settlement', 'status': 'Investigating'},
    ],
    );
  }
}
