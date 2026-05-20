import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class Ifrs9EngineScreen extends StatelessWidget {
  const Ifrs9EngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'IFRS 9 Engine',
      apiEndpoint: '/api/ifrs9/v1/classifications',
      columnKeys: const ['portfolio', 'stage', 'balance', 'ecl', 'coverage'],
      columnLabels: const ['Portfolio', 'Stage', 'Balance', 'ECL', 'Coverage'],
      seedData: const [
      {'portfolio': 'Corporate Loans', 'stage': 'Stage 1', 'balance': 'NGN 500B', 'ecl': 'NGN 5B', 'coverage': '1.0%'},
      {'portfolio': 'Retail Loans', 'stage': 'Stage 2', 'balance': 'NGN 120B', 'ecl': 'NGN 12B', 'coverage': '10.0%'},
    ],
    );
  }
}
