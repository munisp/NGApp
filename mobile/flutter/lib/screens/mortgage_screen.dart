import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MortgageScreen extends StatelessWidget {
  const MortgageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Mortgage',
      apiEndpoint: '/api/mortgage/v1/applications',
      columnKeys: const ['id', 'applicant', 'property', 'amount', 'status'],
      columnLabels: const ['ID', 'Applicant', 'Property', 'Amount', 'Status'],
      seedData: const [
      {'id': 'MTG-001', 'applicant': 'Amina Bello', 'property': '3-Bed Flat, Lekki Phase 1', 'amount': 'NGN 85M', 'status': 'Approved'},
    ],
    );
  }
}
