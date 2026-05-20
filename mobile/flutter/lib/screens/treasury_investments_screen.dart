import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TreasuryInvestmentsScreen extends StatelessWidget {
  const TreasuryInvestmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Investments',
      apiEndpoint: '/api/treasury/v1/investments',
      columnKeys: const ['id', 'instrument', 'faceValue', 'yield', 'maturity'],
      columnLabels: const ['ID', 'Instrument', 'Face Value', 'Yield', 'Maturity'],
      seedData: const [
      {'id': 'INV-001', 'instrument': 'FGN Bond 2031', 'faceValue': 'NGN 25B', 'yield': '14.2%', 'maturity': '2031-03-15'},
    ],
    );
  }
}
