import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class IdempotencyDashboardScreen extends StatelessWidget {
  const IdempotencyDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Idempotency Dashboard',
      apiEndpoint: '/api/platform/idempotency/keys',
      columnKeys: const ['key', 'method', 'endpoint', 'tenantId', 'statusCode', 'hitCount'],
      columnLabels: const ['Key', 'Method', 'Endpoint', 'Tenant', 'Status', 'Hits'],
      seedData: const [
              {'key': 'idem-txn-001-dangote-5b', 'method': 'POST', 'endpoint': '/api/payments/v1/transfers', 'tenantId': 'TEN-GTBANK', 'statusCode': '201', 'hitCount': '3'},
              {'key': 'idem-loan-002-bua-10b', 'method': 'POST', 'endpoint': '/api/loans/v1/applications', 'tenantId': 'TEN-FIRSTBANK', 'statusCode': '201', 'hitCount': '1'},
      ],
    );
  }
}
