import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TlsTerminatorScreen extends StatelessWidget {
  const TlsTerminatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TLS Terminator',
      apiPath: '/api/security-hardening/tls-terminator/list',
      columnLabels: ["Domain", "Protocol", "Status"],
    );
  }
}
