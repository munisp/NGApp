import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgentKycCaptureScreen extends StatelessWidget {
  const AgentKycCaptureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agent KYC Capture',
      apiEndpoint: '/api/kyc-enhanced/agent-captures',
      columnKeys: const ['id', 'agentName', 'customerName', 'lga', 'offlineCapture', 'qualityScore'],
      columnLabels: const ['ID', 'Agent', 'Customer', 'LGA', 'Offline', 'Quality'],
      seedData: const [
        {'id': 'AGENT_KYC_CAPTURE-001', 'status': 'active'},
        {'id': 'AGENT_KYC_CAPTURE-002', 'status': 'pending'},
      ],
    );
  }
}
