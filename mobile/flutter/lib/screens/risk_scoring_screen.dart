import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RiskScoringScreen extends StatelessWidget {
  const RiskScoringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Risk Scoring',
      apiEndpoint: '/api/risk/v1/scores',
      columnKeys: const ['entity', 'category', 'score', 'grade'],
      columnLabels: const ['Entity', 'Category', 'Score', 'Grade'],
      seedData: const [
      {'entity': '54Bank Overall', 'category': 'Operational Risk', 'score': '85', 'grade': 'Low Risk'},
    ],
    );
  }
}
