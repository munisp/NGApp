import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FxRevaluationScreen extends StatelessWidget {
  const FxRevaluationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FX Revaluation',
      apiEndpoint: '/api/fx/v1/revaluation',
      columnKeys: const ['currency', 'position', 'rate', 'pnl'],
      columnLabels: const ['Currency', 'Position', 'Rate', 'P&L'],
      seedData: const [
      {'currency': 'USD', 'position': 'USD 150M', 'rate': '1,565', 'pnl': 'NGN 2.3B'},
    ],
    );
  }
}
