import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LcrNsfrScreen extends StatelessWidget {
  const LcrNsfrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'LCR / NSFR',
      apiEndpoint: '/api/basel/v1/lcr-nsfr',
      columnKeys: const ['metric', 'value', 'minimum', 'status'],
      columnLabels: const ['Metric', 'Value', 'Minimum', 'Status'],
      seedData: const [
      {'metric': 'LCR', 'value': '185%', 'minimum': '100%', 'status': 'Compliant'},
      {'metric': 'NSFR', 'value': '142%', 'minimum': '100%', 'status': 'Compliant'},
    ],
    );
  }
}
