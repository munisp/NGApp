import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SyndicatedLoansScreen extends StatelessWidget {
  const SyndicatedLoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Syndicated Loans',
      apiEndpoint: '/api/syndication/v1/deals',
      columnKeys: const ['id', 'borrower', 'total', 'ourShare', 'status'],
      columnLabels: const ['ID', 'Borrower', 'Total', 'Our Share', 'Status'],
      seedData: const [
      {'id': 'SYN-001', 'borrower': 'MTN Nigeria', 'total': 'USD 500M', 'ourShare': 'USD 75M', 'status': 'Active'},
    ],
    );
  }
}
