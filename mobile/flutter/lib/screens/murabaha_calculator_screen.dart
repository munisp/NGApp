import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MurabahaCalculatorScreen extends StatelessWidget {
  const MurabahaCalculatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Murabaha Calculator',
      apiEndpoint: '/api/islamic/v1/murabaha',
      columnKeys: const ['product', 'cost', 'markup', 'total', 'tenor'],
      columnLabels: const ['Product', 'Cost Price', 'Markup', 'Total', 'Tenor'],
      seedData: const [
      {'product': 'Murabaha Home', 'cost': 'NGN 50M', 'markup': 'NGN 15M', 'total': 'NGN 65M', 'tenor': '180 months'},
    ],
    );
  }
}
