import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PaymentTransactionsScreen extends StatelessWidget {
  const PaymentTransactionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Payment Transactions',
      apiEndpoint: '/api/payments/v1/all',
      columnKeys: const ['id', 'type', 'amount', 'date', 'status'],
      columnLabels: const ['ID', 'Type', 'Amount', 'Date', 'Status'],
      seedData: const [
      {'id': 'TXN-001', 'type': 'Transfer', 'amount': 'NGN 500,000', 'date': '2026-05-09', 'status': 'Completed'},
      {'id': 'TXN-002', 'type': 'Bill Pay', 'amount': 'NGN 24,500', 'date': '2026-05-09', 'status': 'Completed'},
    ],
    );
  }
}
