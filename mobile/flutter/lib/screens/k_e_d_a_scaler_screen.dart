import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KEDAScalerScreen extends StatelessWidget {
  const KEDAScalerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KEDA Event Scaler',
      apiPath: '/api/performance/keda-scaler/list',
      columnLabels: ["Object", "Trigger", "Metric"],
    );
  }
}
