import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CreditBureauScreen extends StatelessWidget {
  const CreditBureauScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Credit Bureau',
      apiEndpoint: '/api/credit-bureau/v1/reports',
      columnKeys: const ['bvn', 'name', 'score', 'facilities', 'status'],
      columnLabels: const ['BVN', 'Name', 'Score', 'Facilities', 'Status'],
      seedData: const [
      {'bvn': '22100456789', 'name': 'Adebayo Ogunlade', 'score': '680', 'facilities': '3', 'status': 'Good Standing'},
    ],
    );
  }
}
