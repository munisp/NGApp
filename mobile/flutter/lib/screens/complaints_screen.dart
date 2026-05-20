import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ComplaintsScreen extends StatelessWidget {
  const ComplaintsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Complaints',
      apiEndpoint: '/api/complaints/v1/tickets',
      columnKeys: const ['id', 'customer', 'category', 'priority', 'status'],
      columnLabels: const ['ID', 'Customer', 'Category', 'Priority', 'Status'],
      seedData: const [
      {'id': 'CMP-001', 'customer': 'Chidi Eze', 'category': 'Service Quality', 'priority': 'High', 'status': 'Open'},
    ],
    );
  }
}
