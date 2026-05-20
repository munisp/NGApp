import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriculturalInsuranceScreen extends StatelessWidget {
  const AgriculturalInsuranceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agricultural Insurance',
      apiEndpoint: '/api/agri/v1/policies',
      columnKeys: const ['id', 'farmer', 'crop', 'coverage', 'status'],
      columnLabels: const ['ID', 'Farmer', 'Crop', 'Coverage', 'Status'],
      seedData: const [
      {'id': 'AGI-001', 'farmer': 'Malam Garba', 'crop': 'Rice (Ofada)', 'coverage': 'NGN 5M', 'status': 'Active'},
      {'id': 'AGI-002', 'farmer': 'Mrs. Funke Adeyemi', 'crop': 'Cassava', 'coverage': 'NGN 3M', 'status': 'Active'},
    ],
    );
  }
}
