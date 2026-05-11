import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AuditTrailScreen extends StatelessWidget {
  const AuditTrailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Audit Trail',
      apiEndpoint: '/api/audit-trail/v1/events',
      columnKeys: const ['id', 'action', 'actor', 'entity', 'time'],
      columnLabels: const ['ID', 'Action', 'Actor', 'Entity', 'Time'],
      seedData: const [
      {'id': 'AUD-001', 'action': 'CREATE', 'actor': 'admin@54bank.app', 'entity': 'Customer', 'time': '2026-05-09 14:30'},
    ],
    );
  }
}
