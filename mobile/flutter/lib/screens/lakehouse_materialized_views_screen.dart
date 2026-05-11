import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseMaterializedViewsScreen extends StatelessWidget {
  const LakehouseMaterializedViewsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Materialized Views',
      apiEndpoint: '/api/platform/lakehouse/materialized-views',
      columnKeys: const ['id', 'name', 'sourceTable', 'refreshSchedule', 'rowCount', 'status'],
      columnLabels: const ['ID', 'Name', 'Source', 'Schedule', 'Rows', 'Status'],
      seedData: const [
              {'id': 'MV-001', 'name': 'daily_transaction_summary', 'sourceTable': 'payments_cdc', 'refreshSchedule': 'hourly', 'rowCount': '365', 'status': 'active'},
              {'id': 'MV-002', 'name': 'customer_360_summary', 'sourceTable': 'customer_360', 'refreshSchedule': 'daily', 'rowCount': '2500000', 'status': 'active'},
      ],
    );
  }
}
