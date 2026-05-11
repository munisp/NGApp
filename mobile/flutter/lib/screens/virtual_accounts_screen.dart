import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VirtualAccountsScreen extends StatelessWidget {
  const VirtualAccountsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Virtual Accounts',
      apiEndpoint: '/api/virtual-accounts/v1/vans',
      columnKeys: const ['van', 'customer', 'purpose', 'collections', 'status'],
      columnLabels: const ['VAN', 'Customer', 'Purpose', 'Collections', 'Status'],
      seedData: const [
      {'van': '9912345001', 'customer': 'Jumia Nigeria', 'purpose': 'Collection', 'collections': 'NGN 2.3B', 'status': 'Active'},
      {'van': '9912345002', 'customer': 'Konga.com', 'purpose': 'Settlement', 'collections': 'NGN 890M', 'status': 'Active'},
    ],
    );
  }
}
