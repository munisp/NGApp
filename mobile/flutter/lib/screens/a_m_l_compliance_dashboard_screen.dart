import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AMLComplianceDashboardScreen extends StatelessWidget {
  const AMLComplianceDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'AML Compliance Dashboard',
      apiPath: '/api/aml-enhancement/aml-compliance-dashboard/list',
      columnLabels: ["Period", "Screenings", "SARs"],
    );
  }
}
