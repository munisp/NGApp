import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OpenappsecRulesScreen extends StatelessWidget {
  const OpenappsecRulesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WAF Rules',
      apiEndpoint: '/api/platform/openappsec/rules',
      columnKeys: const ['name', 'category', 'mode', 'severity', 'blockCount24h', 'mlConfidence'],
      columnLabels: const ['Name', 'Category', 'Mode', 'Severity', 'Blocked', 'ML'],
      seedData: const [
              {'name': 'SQL Injection', 'category': 'sql_injection', 'mode': 'prevent', 'severity': 'critical', 'blockCount24h': '1248', 'mlConfidence': '0.98'},
      ],
    );
  }
}
