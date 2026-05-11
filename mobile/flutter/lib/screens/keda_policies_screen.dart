import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KedaPoliciesScreen extends StatelessWidget {
  const KedaPoliciesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KEDA Scaling Policies',
      apiEndpoint: '/api/platform/keda/policies',
      columnKeys: const ['tier', 'description', 'minReplicas', 'maxReplicas', 'targetCPU'],
      columnLabels: const ['Tier', 'Description', 'Min', 'Max', 'CPU%'],
      seedData: const [
              {'tier': 'critical_financial', 'description': 'Core banking, payments, GL', 'minReplicas': '3', 'maxReplicas': '30', 'targetCPU': '60'},
              {'tier': 'security_compliance', 'description': 'Fraud, KYC, AML, PBAC', 'minReplicas': '3', 'maxReplicas': '25', 'targetCPU': '50'},
      ],
    );
  }
}
