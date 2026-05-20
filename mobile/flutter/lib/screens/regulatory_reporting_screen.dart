import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RegulatoryReportingScreen extends StatelessWidget {
  const RegulatoryReportingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Regulatory Reporting Engine',
      apiPath: '/api/aml-enhancement/regulatory-reporting/list',
      columnLabels: ["Type", "Period", "Submitted To"],
    );
  }
}
