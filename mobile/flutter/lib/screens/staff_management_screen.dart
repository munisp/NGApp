import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class StaffManagementScreen extends StatelessWidget {
  const StaffManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Staff Management',
      apiEndpoint: '/api/staff/v1/employees',
      columnKeys: const ['id', 'name', 'role', 'branch', 'status'],
      columnLabels: const ['ID', 'Name', 'Role', 'Branch', 'Status'],
      seedData: const [
      {'id': 'STF-001', 'name': 'Adebayo Admin', 'role': 'Branch Manager', 'branch': 'Marina HQ', 'status': 'Active'},
    ],
    );
  }
}
