import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HAMiddlewareScreen extends StatelessWidget {
  const HAMiddlewareScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'HA Middleware',
      apiEndpoint: '/api/platform/ha/middleware',
      columnKeys: const ['name', 'type', 'replicas', 'mode', 'failoverTimeMs', 'rpo', 'rto'],
      columnLabels: const ['Name', 'Type', 'Replicas', 'Mode', 'Failover ms', 'RPO', 'RTO'],
      seedData: const [
              {'name': 'PostgreSQL', 'type': 'database', 'replicas': '3', 'mode': 'streaming-replication', 'failoverTimeMs': '5000', 'rpo': '0s', 'rto': '5s'},
              {'name': 'TigerBeetle', 'type': 'ledger', 'replicas': '6', 'mode': 'viewstamped-replication', 'failoverTimeMs': '100', 'rpo': '0ms', 'rto': '100ms'},
      ],
    );
  }
}
