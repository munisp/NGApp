import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SARFilingEngineScreen extends StatelessWidget {
  const SARFilingEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SAR Filing Engine',
      apiPath: '/api/aml-enhancement/sar-filing/list',
      columnLabels: ["Customer ID", "Customer", "Type"],
    );
  }
}
