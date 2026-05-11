import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerInsightsScreen extends StatelessWidget {
  const CustomerInsightsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Insights',
      apiEndpoint: '/api/insights/v1/metrics',
      columnKeys: const ['metric', 'value', 'trend'],
      columnLabels: const ['Metric', 'Value', 'Trend'],
      seedData: const [
      {'metric': 'NPS Score', 'value': '72', 'trend': '+5'},
      {'metric': 'Churn Rate', 'value': '2.1%', 'trend': '-0.3%'},
    ],
    );
  }
}
