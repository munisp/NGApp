import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerEngagementScreen extends StatelessWidget {
  const CustomerEngagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Engagement',
      apiEndpoint: '/api/engagement/v1/campaigns',
      columnKeys: const ['id', 'campaign', 'channel', 'reach', 'conversion'],
      columnLabels: const ['ID', 'Campaign', 'Channel', 'Reach', 'Conversion'],
      seedData: const [
      {'id': 'ENG-001', 'campaign': '54Save Promo', 'channel': 'SMS', 'reach': '500K', 'conversion': '12%'},
    ],
    );
  }
}
