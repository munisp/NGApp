import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PrometheusDashboardScreen extends StatelessWidget {
  const PrometheusDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Prometheus Dashboard',
      apiPath: '/api/performance/prometheus-dashboard/list',
      columnLabels: ["Dashboard", "Panels", "Alert Rules"],
    );
  }
}
