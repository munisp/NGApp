import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LcAmendmentsScreen extends StatelessWidget {
  const LcAmendmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'LC Amendments',
      apiEndpoint: '/api/trade/v1/lc-amendments',
      columnKeys: const ['id', 'lcRef', 'type', 'status'],
      columnLabels: const ['ID', 'LC Ref', 'Amendment', 'Status'],
      seedData: const [
      {'id': 'LCA-001', 'lcRef': 'LC-001', 'type': 'Amount Increase', 'status': 'Approved'},
    ],
    );
  }
}
