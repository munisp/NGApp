import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerDashboardScreen extends StatelessWidget {
  const CustomerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Dashboard',
      apiEndpoint: '/api/dashboard/v1/customer',
      columnKeys: const ['metric', 'value'],
      columnLabels: const ['Metric', 'Value'],
      seedData: const [
      {'metric': 'Total Balance', 'value': 'NGN 25,000,000'},
      {'metric': 'Pending Transfers', 'value': '2'},
      {'metric': 'Active Cards', 'value': '3'},
      {'metric': 'Loan Outstanding', 'value': 'NGN 1,500,000'},
    ],
    );
  }
}
