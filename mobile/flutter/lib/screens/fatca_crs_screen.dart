import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FatcaCrsScreen extends StatelessWidget {
  const FatcaCrsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FATCA / CRS',
      apiEndpoint: '/api/fatca/v1/reports',
      columnKeys: const ['id', 'customer', 'jurisdiction', 'status'],
      columnLabels: const ['ID', 'Customer', 'Jurisdiction', 'Status'],
      seedData: const [
      {'id': 'FAT-001', 'customer': 'US Dual Citizen', 'jurisdiction': 'USA', 'status': 'Reported'},
    ],
    );
  }
}
