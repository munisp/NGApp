import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TradeFinanceScreen extends StatelessWidget {
  const TradeFinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Trade Finance',
      apiEndpoint: '/api/trade/v1/instruments',
      columnKeys: const ['id', 'type', 'applicant', 'beneficiary', 'amount', 'status'],
      columnLabels: const ['ID', 'Type', 'Applicant', 'Beneficiary', 'Amount', 'Status'],
      seedData: const [
      {'id': 'LC-001', 'type': 'Letter of Credit', 'applicant': 'Dangote Industries', 'beneficiary': 'Sinoma (China)', 'amount': 'USD 45M', 'status': 'Confirmed'},
      {'id': 'BG-001', 'type': 'Bank Guarantee', 'applicant': 'Julius Berger', 'beneficiary': 'FG Nigeria', 'amount': 'NGN 15B', 'status': 'Active'},
    ],
    );
  }
}
