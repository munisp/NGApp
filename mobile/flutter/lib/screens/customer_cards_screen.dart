import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerCardsScreen extends StatelessWidget {
  const CustomerCardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Cards',
      apiEndpoint: '/api/cards/v1/customer',
      columnKeys: const ['pan', 'type', 'scheme', 'expiry', 'status'],
      columnLabels: const ['Card', 'Type', 'Scheme', 'Expiry', 'Status'],
      seedData: const [
      {'pan': '****5234', 'type': 'Debit', 'scheme': 'Verve', 'expiry': '12/28', 'status': 'Active'},
    ],
    );
  }
}
