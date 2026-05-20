import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CreditRiskScreen extends StatelessWidget {
  const CreditRiskScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Credit Risk',
      apiEndpoint: '/api/risk/v1/credit-scores',
      columnKeys: const ['customer', 'score', 'grade', 'pd', 'lgd'],
      columnLabels: const ['Customer', 'Score', 'Grade', 'PD', 'LGD'],
      seedData: const [
      {'customer': 'Dangote Industries', 'score': '850', 'grade': 'AAA', 'pd': '0.1%', 'lgd': '5%'},
      {'customer': 'Amina Bello', 'score': '720', 'grade': 'A', 'pd': '2.5%', 'lgd': '25%'},
    ],
    );
  }
}
