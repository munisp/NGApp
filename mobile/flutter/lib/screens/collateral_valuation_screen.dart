import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CollateralValuationScreen extends StatelessWidget {
  const CollateralValuationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Collateral Valuation',
      apiEndpoint: '/api/collateral/v1/valuations',
      columnKeys: const ['id', 'asset', 'lastVal', 'currentVal', 'method'],
      columnLabels: const ['ID', 'Asset', 'Last Value', 'Current', 'Method'],
      seedData: const [
      {'id': 'VAL-001', 'asset': 'Banana Island Plot', 'lastVal': 'NGN 2.0B', 'currentVal': 'NGN 2.5B', 'method': 'Market Comparison'},
    ],
    );
  }
}
