import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NdprComplianceScreen extends StatelessWidget {
  const NdprComplianceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'NDPR Compliance',
      apiPath: '/api/security-hardening/ndpr-compliance/list',
      columnLabels: ["Type", "Subject", "Status"],
    );
  }
}
