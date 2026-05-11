import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class Customer360Screen extends StatelessWidget {
  const Customer360Screen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer 360',
      apiEndpoint: '/api/customers/v1/profiles',
      columnKeys: const ['id', 'name', 'segment', 'value', 'risk'],
      columnLabels: const ['ID', 'Name', 'Segment', 'Value', 'Risk'],
      seedData: const [
      {'id': 'CUS-001', 'name': 'Dangote Industries', 'segment': 'Corporate', 'value': 'NGN 45.2B', 'risk': 'Low'},
      {'id': 'CUS-002', 'name': 'Amina Bello', 'segment': 'Retail Premium', 'value': 'NGN 85M', 'risk': 'Low'},
      {'id': 'CUS-003', 'name': 'NNPC Ltd', 'segment': 'Government', 'value': 'NGN 120B', 'risk': 'Medium'},
    ],
    );
  }
}
