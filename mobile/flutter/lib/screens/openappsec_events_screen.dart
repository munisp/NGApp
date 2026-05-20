import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OpenappsecEventsScreen extends StatelessWidget {
  const OpenappsecEventsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WAF Events',
      apiEndpoint: '/api/platform/openappsec/events',
      columnKeys: const ['ruleName', 'sourceIP', 'action', 'severity', 'geoCountry'],
      columnLabels: const ['Rule', 'Source IP', 'Action', 'Severity', 'Country'],
      seedData: const [
              {'ruleName': 'SQL Injection', 'sourceIP': '185.220.101.42', 'action': 'blocked', 'severity': 'critical', 'geoCountry': 'Romania'},
      ],
    );
  }
}
