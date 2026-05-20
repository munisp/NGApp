import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SalaryProcessingScreen extends StatelessWidget {
  const SalaryProcessingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Salary Processing',
      apiEndpoint: '/api/salary/v1/batches',
      columnKeys: const ['id', 'company', 'employees', 'total', 'status'],
      columnLabels: const ['ID', 'Company', 'Staff', 'Total', 'Status'],
      seedData: const [
      {'id': 'SAL-001', 'company': 'Dangote Industries', 'employees': '3,200', 'total': 'NGN 450M', 'status': 'Scheduled'},
      {'id': 'SAL-002', 'company': 'MTN Nigeria', 'employees': '1,800', 'total': 'NGN 380M', 'status': 'Completed'},
    ],
    );
  }
}
