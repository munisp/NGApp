import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BrowserFingerprintScreen extends StatelessWidget {
  const BrowserFingerprintScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Browser Fingerprint',
      apiPath: '/api/security-hardening/browser-fingerprint/list',
      columnLabels: ["Fingerprint", "Device", "Status"],
    );
  }
}
