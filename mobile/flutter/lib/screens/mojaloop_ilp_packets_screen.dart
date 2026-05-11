import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopILPPacketsScreen extends StatelessWidget {
  const MojaloopILPPacketsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ILP Packets',
      apiEndpoint: '/api/platform/mojaloop/ilp-packets',
      columnKeys: const ['id', 'transferId', 'currency', 'amount', 'status', 'verificationResult'],
      columnLabels: const ['ID', 'Transfer', 'Currency', 'Amount', 'Status', 'Verified'],
      seedData: const [
              {'id': 'ILP-001', 'transferId': 'TXN-MOJA-001', 'currency': 'NGN', 'amount': '5000000', 'status': 'fulfilled', 'verificationResult': 'valid'},
              {'id': 'ILP-003', 'transferId': 'TXN-XBORDER-001', 'currency': 'USD', 'amount': '100000', 'status': 'fulfilled', 'verificationResult': 'valid'},
      ],
    );
  }
}
