import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ChequeImagingScreen extends StatelessWidget {
  const ChequeImagingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cheque Imaging',
      apiEndpoint: '/api/cheques/v1/imaging',
      columnKeys: const ['id', 'chequeNo', 'amount', 'status'],
      columnLabels: const ['ID', 'Cheque No', 'Amount', 'Status'],
      seedData: const [
      {'id': 'CI-001', 'chequeNo': '000123456', 'amount': 'NGN 50M', 'status': 'Imaged'},
    ],
    );
  }
}
