import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BranchOperationsScreen extends StatelessWidget {
  const BranchOperationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Branch Operations',
      apiEndpoint: '/api/branch-operations/v1/branches',
      columnKeys: const ['id', 'name', 'location', 'staff', 'status'],
      columnLabels: const ['ID', 'Branch', 'Location', 'Staff', 'Status'],
      seedData: const [
      {'id': 'BR-001', 'name': 'Marina Head Office', 'location': 'Lagos Island', 'staff': '250', 'status': 'Open'},
      {'id': 'BR-002', 'name': 'Abuja Central', 'location': 'Central Area, Abuja', 'staff': '120', 'status': 'Open'},
      {'id': 'BR-003', 'name': 'Kano Main', 'location': 'Nassarawa, Kano', 'staff': '80', 'status': 'Open'},
    ],
    );
  }
}
