import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MfaOrchestratorScreen extends StatelessWidget {
    const MfaOrchestratorScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'MFA Orchestrator',
      apiPath: '/api/security/mfa/enrollments',
      columnLabels:   const MfaOrchestratorScreen({Key? key}) : super(key: key);
            'customerId': 'Customer Id',
            'primaryMethod': 'Primary Method',
            'backupMethod': 'Backup Method',
            'status': 'Status',
            'riskLevel': 'Risk Level',      },
    );
  }
}
