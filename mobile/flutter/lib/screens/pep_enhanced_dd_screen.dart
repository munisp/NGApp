import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PepEnhancedDdScreen extends StatelessWidget {
  const PepEnhancedDdScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PEP Enhanced DD',
      apiEndpoint: '/api/kyc-enhanced/pep-edd-rules',
      columnKeys: const ['id', 'name', 'pepCategory', 'enforcement'],
      columnLabels: const ['ID', 'Rule', 'Category', 'Enforcement'],
      seedData: const [
        {'id': 'PEP_ENHANCED_DD-001', 'status': 'active'},
        {'id': 'PEP_ENHANCED_DD-002', 'status': 'pending'},
      ],
    );
  }
}
