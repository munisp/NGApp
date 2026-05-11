import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StandingOrdersScreen extends StatelessWidget {
  const StandingOrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Standing Orders',
      apiEndpoint: '/api/standing-orders/v1/orders',
      columnKeys: const ['id', 'customer', 'amount', 'frequency', 'status'],
      columnLabels: const ['ID', 'Customer', 'Amount', 'Freq', 'Status'],
      seedData: const [
      {'id': 'SO-001', 'customer': 'Dangote Group', 'amount': 'NGN 5,000,000', 'frequency': 'Monthly', 'status': 'Active'},
      {'id': 'SO-002', 'customer': 'Amina Bello', 'amount': 'NGN 50,000', 'frequency': 'Weekly', 'status': 'Active'},
    ],
    );
  }
}
