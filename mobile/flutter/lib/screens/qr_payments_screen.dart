import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class QrPaymentsScreen extends StatelessWidget {
  const QrPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'QR Payments',
      apiEndpoint: '/api/payments/v1/qr',
      columnKeys: const ['id', 'merchant', 'amount', 'channel', 'status'],
      columnLabels: const ['ID', 'Merchant', 'Amount', 'Channel', 'Status'],
      seedData: const [
      {'id': 'QR-001', 'merchant': 'Shoprite Ikeja', 'amount': 'NGN 45,000', 'channel': 'NQR', 'status': 'Completed'},
    ],
    );
  }
}
