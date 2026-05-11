import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GrafanaDashboardsScreen extends StatelessWidget {
  const GrafanaDashboardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Grafana Dashboards',
      apiEndpoint: '/api/platform/observability/grafana-dashboards',
      columnKeys: const ['title', 'category', 'panels', 'refreshInterval'],
      columnLabels: const ['Dashboard', 'Category', 'Panels', 'Refresh'],
      seedData: const [
              {'title': '54Bank Overview', 'category': 'overview', 'panels': '24', 'refreshInterval': '10s'},
      ],
    );
  }
}
