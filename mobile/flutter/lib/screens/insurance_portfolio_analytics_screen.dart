import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InsurancePortfolioAnalyticsScreen extends StatelessWidget {
  const InsurancePortfolioAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Insurance Analytics',
      apiPath: '/api/agriculture-enhancement/insurance-portfolio-analytics/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
