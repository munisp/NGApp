import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DatabasePersistenceScreen extends StatelessWidget {
  const DatabasePersistenceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Database Persistence',
      apiEndpoint: '/api/database/v1/schema',
      columnKeys: const ['name', 'columns', 'rls', 'tenantScoped'],
      columnLabels: const ['Table', 'Cols', 'RLS', 'Tenant'],
      seedData: const [
      {'name': 'customers', 'columns': '25', 'rls': 'tenant_isolation', 'tenantScoped': 'Yes'},
      {'name': 'accounts', 'columns': '18', 'rls': 'tenant_isolation', 'tenantScoped': 'Yes'},
      {'name': 'transactions', 'columns': '32', 'rls': 'tenant_isolation', 'tenantScoped': 'Yes'},
    ],
    );
  }
}
