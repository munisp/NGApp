import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NfiuCtrStrFilingScreen extends StatelessWidget {
  const NfiuCtrStrFilingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'NFIU CTR/STR Filing',
      apiEndpoint: '/api/kyc-enhanced/ctrs',
      columnKeys: const ['id', 'customerName', 'amountNGN', 'transactionType', 'status', 'slaStatus'],
      columnLabels: const ['ID', 'Customer', 'Amount', 'Type', 'Status', 'SLA'],
      seedData: const [
        {'id': 'NFIU_CTR_STR_FILING-001', 'status': 'active'},
        {'id': 'NFIU_CTR_STR_FILING-002', 'status': 'pending'},
      ],
    );
  }
}
