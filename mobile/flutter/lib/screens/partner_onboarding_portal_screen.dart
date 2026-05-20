import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PartnerOnboardingPortalScreen extends StatelessWidget {
  const PartnerOnboardingPortalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Partner Portal',
      apiEndpoint: '/api/partners/v1/portal',
      columnKeys: const ['id', 'partner', 'step', 'progress'],
      columnLabels: const ['ID', 'Partner', 'Step', 'Progress'],
      seedData: const [
      {'id': 'PP-001', 'partner': 'Sterling Bank', 'step': 'Integration Testing', 'progress': '75%'},
    ],
    );
  }
}
