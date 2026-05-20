import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SanctionsBatchRescreenerScreen extends StatelessWidget {
  const SanctionsBatchRescreenerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Sanctions Batch Re-screener',
      apiPath: '/api/aml-enhancement/sanctions-batch-rescreener/list',
      columnLabels: ["Trigger", "Screened", "New Matches"],
    );
  }
}
