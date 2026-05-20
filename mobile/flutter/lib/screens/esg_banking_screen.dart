import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EsgBankingScreen extends StatelessWidget {
  const EsgBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ESG Banking',
      apiEndpoint: '/api/esg/v1/scores',
      columnKeys: const ['id', 'entity', 'score', 'rating'],
      columnLabels: const ['ID', 'Entity', 'Score', 'Rating'],
      seedData: const [
      {'id': 'ESG-001', 'entity': 'Dangote Industries', 'score': '72', 'rating': 'A-'},
    ],
    );
  }
}
