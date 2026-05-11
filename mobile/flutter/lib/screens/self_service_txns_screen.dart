import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SelfServiceTxnsScreen extends StatelessWidget {
  const SelfServiceTxnsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Self-Service Transactions',
      apiEndpoint: '/api/self-service/v1/transactions',
      columnKeys: const ['id', 'customer', 'type', 'amount', 'channel'],
      columnLabels: const ['ID', 'Customer', 'Type', 'Amount', 'Channel'],
      seedData: const [
      {'id': 'SS-001', 'customer': 'Amina Bello', 'type': 'Transfer', 'amount': 'NGN 100,000', 'channel': 'Mobile App'},
    ],
    );
  }
}
