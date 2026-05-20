import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AdaptiveRateLimiterScreen extends StatelessWidget {
    const AdaptiveRateLimiterScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Adaptive Rate Limiter',
      apiPath: '/api/security/rate-limits/policies',
      columnLabels:   const AdaptiveRateLimiterScreen({Key? key}) : super(key: key);
            'name': 'Name',
            'endpointPattern': 'Endpoint Pattern',
            'windowSeconds': 'Window Seconds',
            'maxRequests': 'Max Requests',
            'burstLimit': 'Burst Limit',
            'penaltyAction': 'Penalty Action',
            'status': 'Status',      },
    );
  }
}
