import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InfraPostgresScreen extends StatelessWidget {
  const InfraPostgresScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Infra: Postgres',
      apiEndpoint: '/api/infra/v1/postgres',
      columnKeys: const ['id', 'database', 'size', 'connections'],
      columnLabels: const ['ID', 'Database', 'Size', 'Connections'],
      seedData: const [
      {'id': 'PG-001', 'database': '54bank_prod', 'size': '45 GB', 'connections': '120/500'},
    ],
    );
  }
}
