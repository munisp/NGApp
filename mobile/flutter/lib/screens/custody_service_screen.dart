import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustodyServiceScreen extends StatelessWidget {
  const CustodyServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Custody Services',
      apiEndpoint: '/api/custody/v1/assets',
      columnKeys: const ['security', 'qty', 'value', 'custodian'],
      columnLabels: const ['Security', 'Qty', 'Value', 'Custodian'],
      seedData: const [
      {'security': 'FGN Bond 2031', 'qty': '25,000,000', 'value': 'NGN 25.4B', 'custodian': 'CSCS'},
    ],
    );
  }
}
