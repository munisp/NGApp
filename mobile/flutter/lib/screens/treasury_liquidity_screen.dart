import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TreasuryLiquidityScreen extends StatelessWidget {
  const TreasuryLiquidityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Liquidity Management',
      apiEndpoint: '/api/treasury/v1/liquidity',
      columnKeys: const ['metric', 'value', 'threshold', 'status'],
      columnLabels: const ['Metric', 'Value', 'Threshold', 'Status'],
      seedData: const [
      {'metric': 'LCR', 'value': '185%', 'threshold': '100%', 'status': 'Compliant'},
      {'metric': 'NSFR', 'value': '142%', 'threshold': '100%', 'status': 'Compliant'},
      {'metric': 'CRR', 'value': '32.5%', 'threshold': '32.5%', 'status': 'Compliant'},
    ],
    );
  }
}
