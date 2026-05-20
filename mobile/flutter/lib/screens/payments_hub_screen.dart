import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PaymentsHubScreen extends StatelessWidget {
  const PaymentsHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Payments Hub',
      apiEndpoint: '/api/payments/v1/transactions',
      columnKeys: const ['id', 'sender', 'receiver', 'amount', 'channel', 'status'],
      columnLabels: const ['ID', 'Sender', 'Receiver', 'Amount', 'Channel', 'Status'],
      seedData: const [
      {'id': 'PAY-001', 'sender': 'Dangote Industries', 'receiver': 'BUA Cement', 'amount': 'NGN 2.5B', 'channel': 'NIBSS', 'status': 'Completed'},
      {'id': 'PAY-002', 'sender': 'Amina Bello', 'receiver': 'MTN Nigeria', 'amount': 'NGN 5,000', 'channel': 'USSD', 'status': 'Completed'},
      {'id': 'PAY-003', 'sender': 'NNPC Ltd', 'receiver': 'Zenith Bank', 'amount': 'NGN 45B', 'channel': 'RTGS', 'status': 'Processing'},
      {'id': 'PAY-004', 'sender': 'Chidi Eze', 'receiver': 'DSTV', 'amount': 'NGN 24,500', 'channel': 'Bill Pay', 'status': 'Completed'},
    ],
    );
  }
}
