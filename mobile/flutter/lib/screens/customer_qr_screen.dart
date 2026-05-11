import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerQrScreen extends StatelessWidget {
  const CustomerQrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer QR',
      apiEndpoint: '/api/qr/v1/customer',
      columnKeys: const ['id', 'merchant', 'amount', 'status'],
      columnLabels: const ['ID', 'Merchant', 'Amount', 'Status'],
      seedData: const [
      {'id': 'CQR-001', 'merchant': 'Shoprite', 'amount': 'NGN 45,000', 'status': 'Paid'},
    ],
    );
  }
}
