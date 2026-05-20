import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerOnboardingScreen extends StatelessWidget {
  const CustomerOnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Onboarding',
      apiEndpoint: '/api/customers/v1/onboarding',
      columnKeys: const ['id', 'name', 'bvn', 'tier', 'status'],
      columnLabels: const ['ID', 'Name', 'BVN', 'Tier', 'Status'],
      seedData: const [
      {'id': 'ONB-001', 'name': 'Adebayo Ogunlade', 'bvn': '22100456789', 'tier': 'Tier 3', 'status': 'Complete'},
      {'id': 'ONB-002', 'name': 'Chidinma Okafor', 'bvn': '22100567890', 'tier': 'Tier 2', 'status': 'Pending KYC'},
      {'id': 'ONB-003', 'name': 'Emeka Nwankwo', 'bvn': '22100678901', 'tier': 'Tier 1', 'status': 'In Review'},
      {'id': 'ONB-004', 'name': 'Fatima Abdullahi', 'bvn': '22100789012', 'tier': 'Tier 3', 'status': 'Complete'},
      {'id': 'ONB-005', 'name': 'Gbenga Adeyemi', 'bvn': '22100890123', 'tier': 'Tier 2', 'status': 'Documents Required'},
    ],
    );
  }
}
