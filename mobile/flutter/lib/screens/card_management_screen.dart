import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CardManagementScreen extends StatelessWidget {
  const CardManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Card Management',
      apiEndpoint: '/api/cards/v1/inventory',
      columnKeys: const ['pan', 'holder', 'type', 'scheme', 'status'],
      columnLabels: const ['Card', 'Holder', 'Type', 'Scheme', 'Status'],
      seedData: const [
      {'pan': '****5234', 'holder': 'Amina Bello', 'type': 'Debit', 'scheme': 'Verve', 'status': 'Active'},
      {'pan': '****8901', 'holder': 'Dangote Industries', 'type': 'Corporate', 'scheme': 'Mastercard', 'status': 'Active'},
      {'pan': '****3456', 'holder': 'Chidi Eze', 'type': 'Prepaid', 'scheme': 'Visa', 'status': 'Active'},
    ],
    );
  }
}
