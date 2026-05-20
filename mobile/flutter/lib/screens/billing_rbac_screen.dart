import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BillingRbacScreen extends StatelessWidget {
  const BillingRbacScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Billing RBAC',
      apiEndpoint: '/api/billing/v1/rbac',
      columnKeys: const ['id', 'role', 'permissions', 'users'],
      columnLabels: const ['ID', 'Role', 'Permissions', 'Users'],
      seedData: const [
      {'id': 'BR-001', 'role': 'Billing Admin', 'permissions': 'Full Access', 'users': '3'},
    ],
    );
  }
}
