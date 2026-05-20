import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FaceMatchScreen extends StatelessWidget {
  const FaceMatchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Face Match',
      apiEndpoint: '/api/kyc/v1/face-match',
      columnKeys: const ['id', 'customer', 'score', 'status'],
      columnLabels: const ['ID', 'Customer', 'Score', 'Status'],
      seedData: const [
      {'id': 'FM-001', 'customer': 'Adebayo Ogunlade', 'score': '98.5%', 'status': 'Matched'},
    ],
    );
  }
}
