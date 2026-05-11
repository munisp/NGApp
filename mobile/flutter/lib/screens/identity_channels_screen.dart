import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class IdentityChannelsScreen extends StatelessWidget {
  const IdentityChannelsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Identity Channels',
      apiEndpoint: '/api/kyc/v1/channels',
      columnKeys: const ['id', 'provider', 'type', 'status'],
      columnLabels: const ['ID', 'Provider', 'Type', 'Status'],
      seedData: const [
      {'id': 'IDC-001', 'provider': 'VerifyMe', 'type': 'NIN Verification', 'status': 'Active'},
      {'id': 'IDC-002', 'provider': 'Smile Identity', 'type': 'BVN + Liveness', 'status': 'Active'},
    ],
    );
  }
}
