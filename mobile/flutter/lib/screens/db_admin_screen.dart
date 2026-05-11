import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DbAdminScreen extends StatelessWidget {
  const DbAdminScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Database Admin',
      apiEndpoint: '/api/db/v1/tables',
      columnKeys: const ['table', 'rows', 'size', 'lastVacuum'],
      columnLabels: const ['Table', 'Rows', 'Size', 'Last Vacuum'],
      seedData: const [
      {'table': 'customers', 'rows': '245,000', 'size': '2.1 GB', 'lastVacuum': '2026-05-09 02:00'},
    ],
    );
  }
}
