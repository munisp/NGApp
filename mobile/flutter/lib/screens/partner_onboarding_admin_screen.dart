import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PartnerOnboardingAdminScreen extends StatelessWidget {
  const PartnerOnboardingAdminScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Partner Onboarding',
      apiEndpoint: '/api/partners/v1/onboarding',
      columnKeys: const ['id', 'partner', 'type', 'status'],
      columnLabels: const ['ID', 'Partner', 'Type', 'Status'],
      seedData: const [
      {'id': 'PO-001', 'partner': 'Sterling Bank', 'type': 'White Label', 'status': 'Active'},
    ],
    );
  }
}
