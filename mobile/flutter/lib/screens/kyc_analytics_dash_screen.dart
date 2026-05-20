import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KycAnalyticsDashScreen extends StatelessWidget {
  const KycAnalyticsDashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KYC Analytics Dashboard',
      apiEndpoint: '/api/kyc-enhanced/analytics-dashboard',
      columnKeys: const ['onboardingFunnel', 'avgOnboardingTime', 'channelBreakdown'],
      columnLabels: const ['Funnel', 'Avg Time', 'Channels'],
      seedData: const [
        {'id': 'KYC_ANALYTICS_DASH-001', 'status': 'active'},
        {'id': 'KYC_ANALYTICS_DASH-002', 'status': 'pending'},
      ],
    );
  }
}
