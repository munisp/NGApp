import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CorsGatewayScreen extends StatelessWidget {
  const CorsGatewayScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CORS Gateway',
      apiEndpoint: '/api/production/cors-gateway/policy',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'CORS_GATEWAY_SCREEN-001', 'status': 'active'},
        {'id': 'CORS_GATEWAY_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
