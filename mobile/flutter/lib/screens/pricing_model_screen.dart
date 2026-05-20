import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PricingModelScreen extends StatelessWidget {
  const PricingModelScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Pricing Model',
      apiEndpoint: '/api/pricing/v1/models',
      columnKeys: const ['id', 'product', 'model', 'rate'],
      columnLabels: const ['ID', 'Product', 'Model', 'Rate'],
      seedData: const [
      {'id': 'PM-001', 'product': 'Current Account', 'model': 'Tiered', 'rate': 'Variable'},
    ],
    );
  }
}
