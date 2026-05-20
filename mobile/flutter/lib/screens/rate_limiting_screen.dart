import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RateLimitingScreen extends StatelessWidget {
  const RateLimitingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'API Rate Limiting',
      apiEndpoint: '/api/rate-limits/v1/tiers',
      columnKeys: const ['name', 'reqPerMin', 'burst', 'tenants'],
      columnLabels: const ['Tier', 'Req/Min', 'Burst', 'Tenants'],
      seedData: const [
      {'name': 'Enterprise', 'reqPerMin': '10,000', 'burst': '1,000', 'tenants': '5'},
      {'name': 'Standard', 'reqPerMin': '1,000', 'burst': '200', 'tenants': '45'},
    ],
    );
  }
}
