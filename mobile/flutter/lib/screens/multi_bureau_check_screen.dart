import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MultiBureauCheckScreen extends StatelessWidget {
  const MultiBureauCheckScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Multi-Bureau Check',
      apiEndpoint: '/api/kyc-enhanced/bureau-checks',
      columnKeys: const ['id', 'customerId', 'bureau', 'creditScore', 'riskGrade', 'activeLoans'],
      columnLabels: const ['ID', 'Customer', 'Bureau', 'Score', 'Grade', 'Loans'],
      seedData: const [
        {'id': 'MULTI_BUREAU_CHECK-001', 'status': 'active'},
        {'id': 'MULTI_BUREAU_CHECK-002', 'status': 'pending'},
      ],
    );
  }
}
