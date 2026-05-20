import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CbnComplianceCheckerScreen extends StatelessWidget {
  const CbnComplianceCheckerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CBN Compliance',
      apiPath: '/api/security-hardening/cbn-compliance/list',
      columnLabels: ["Circular", "Title", "Status"],
    );
  }
}
