import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RansomwareProtectionScreen extends StatelessWidget {
  const RansomwareProtectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Ransomware Protection',
      apiEndpoint: '/api/security/ransomware/indicators',
      columnKeys: const ['id', 'pattern', 'type', 'severity', 'action'],
      columnLabels: const ['ID', 'Pattern', 'Type', 'Severity', 'Action'],
      seedData: const [
      {'id': 'RI-001', 'pattern': '*.encrypted', 'type': 'file_extension', 'severity': 'critical', 'action': 'block'},
      {'id': 'RI-002', 'pattern': '*.locked', 'type': 'file_extension', 'severity': 'critical', 'action': 'block'},
      {'id': 'RI-003', 'pattern': 'rapid_file_modification', 'type': 'encryption_behavior', 'severity': 'critical', 'action': 'quarantine'},
      {'id': 'RI-004', 'pattern': 'shadow_copy_deletion', 'type': 'registry_change', 'severity': 'critical', 'action': 'block'},
    ],
    );
  }
}
