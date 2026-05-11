import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Admin Dashboard',
      apiEndpoint: '/api/platform/overview',
      columnKeys: const ['metric', 'value', 'trend'],
      columnLabels: const ['Metric', 'Value', 'Trend'],
      seedData: const [
      {'metric': 'Total Customers', 'value': '245,000', 'trend': '+3.2%'},
      {'metric': 'Active Accounts', 'value': '412,000', 'trend': '+2.1%'},
      {'metric': 'Today Transactions', 'value': '18,500', 'trend': '+8.5%'},
      {'metric': 'Total Deposits', 'value': 'NGN 2.4T', 'trend': '+1.5%'},
      {'metric': 'Total Loans', 'value': 'NGN 890B', 'trend': '+4.2%'},
      {'metric': 'NPL Ratio', 'value': '3.2%', 'trend': '-0.3%'},
    ],
    );
  }
}
