import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AccessibilityAuditorScreen extends StatelessWidget {
  const AccessibilityAuditorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Accessibility Auditor',
      apiEndpoint: '/api/production/accessibility/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'ACCESSIBILITY_AUDITOR_SCREEN-001', 'status': 'active'},
        {'id': 'ACCESSIBILITY_AUDITOR_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
