import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AMLRiskScoringScreen extends StatelessWidget {
  const AMLRiskScoringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'AML Risk Scoring Engine',
      apiPath: '/api/aml-enhancement/aml-risk-scoring/list',
      columnLabels: ["Customer ID", "Customer", "Risk Score"],
    );
  }
}
