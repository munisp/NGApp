import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AnalyticsWidgetsScreen extends StatelessWidget {
  const AnalyticsWidgetsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Analytics Widgets',
      apiEndpoint: '/api/analytics/v1/widgets',
      columnKeys: const ['name', 'type', 'value'],
      columnLabels: const ['Widget', 'Type', 'Value'],
      seedData: const [
      {'name': 'Revenue Trend', 'type': 'Line Chart', 'value': 'NGN 89B'},
      {'name': 'Customer Growth', 'type': 'Bar Chart', 'value': '+3.2%'},
    ],
    );
  }
}
