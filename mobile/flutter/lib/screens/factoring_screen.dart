import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FactoringScreen extends StatelessWidget {
  const FactoringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Factoring',
      apiEndpoint: '/api/factoring/v1/invoices',
      columnKeys: const ['id', 'seller', 'buyer', 'amount', 'status'],
      columnLabels: const ['ID', 'Seller', 'Buyer', 'Amount', 'Status'],
      seedData: const [
      {'id': 'FAC-001', 'seller': 'BUA Foods', 'buyer': 'Shoprite Nigeria', 'amount': 'NGN 500M', 'status': 'Funded'},
    ],
    );
  }
}
