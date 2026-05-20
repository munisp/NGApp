import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RealtimePricingScreen extends StatelessWidget {
  const RealtimePricingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Real-Time Pricing',
      apiEndpoint: '/api/production/missing-domains/list',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'REALTIME_PRICING_SCREEN-001', 'status': 'active'},
        {'id': 'REALTIME_PRICING_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
