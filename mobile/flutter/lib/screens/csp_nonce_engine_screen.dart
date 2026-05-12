import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CspNonceEngineScreen extends StatelessWidget {
  const CspNonceEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CSP Nonce Engine',
      apiPath: '/api/security-hardening/csp-nonce/list',
      columnLabels: ["Domain", "Violations", "Status"],
    );
  }
}
