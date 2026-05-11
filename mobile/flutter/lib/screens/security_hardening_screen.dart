import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SecurityHardeningScreen extends StatelessWidget {
  const SecurityHardeningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Security Hardening',
      apiEndpoint: '/api/security-hardening/v1/security/policies',
      columnKeys: const ['id', 'name', 'category', 'severity', 'enforced'],
      columnLabels: const ['ID', 'Policy', 'Category', 'Severity', 'Enforced'],
      seedData: const [
      {'id': 'SEC-001', 'name': 'TLS 1.3 Only', 'category': 'Network', 'severity': 'Critical', 'enforced': 'Yes'},
    ],
    );
  }
}
