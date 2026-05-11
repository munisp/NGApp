import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerSegmentsScreen extends StatelessWidget {
  const CustomerSegmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Segments',
      apiEndpoint: '/api/customers/v1/segments',
      columnKeys: const ['id', 'name', 'count', 'avgBalance'],
      columnLabels: const ['ID', 'Segment', 'Customers', 'Avg Balance'],
      seedData: const [
      {'id': 'SEG-001', 'name': 'HNW Individual', 'count': '1,200', 'avgBalance': 'NGN 85M'},
      {'id': 'SEG-002', 'name': 'Corporate', 'count': '450', 'avgBalance': 'NGN 2.5B'},
      {'id': 'SEG-003', 'name': 'Mass Retail', 'count': '200,000', 'avgBalance': 'NGN 150K'},
    ],
    );
  }
}
