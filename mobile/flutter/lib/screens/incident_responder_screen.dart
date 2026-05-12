import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class IncidentResponderScreen extends StatelessWidget {
  const IncidentResponderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Incident Responder',
      apiPath: '/api/security-hardening/incident-responder/list',
      columnLabels: ["Title", "Severity", "Status"],
    );
  }
}
