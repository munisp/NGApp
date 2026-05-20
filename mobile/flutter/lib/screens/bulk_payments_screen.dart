import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BulkPaymentsScreen extends StatelessWidget {
  const BulkPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Bulk Payments',
      apiEndpoint: '/api/payments/v1/bulk',
      columnKeys: const ['id', 'initiator', 'total', 'count', 'status'],
      columnLabels: const ['ID', 'Initiator', 'Total', 'Count', 'Status'],
      seedData: const [
      {'id': 'BLK-001', 'initiator': 'Dangote Group HR', 'total': 'NGN 450M', 'count': '3,200', 'status': 'Processed'},
      {'id': 'BLK-002', 'initiator': 'Lagos State Govt', 'total': 'NGN 2.1B', 'count': '15,000', 'status': 'Pending'},
    ],
    );
  }
}
