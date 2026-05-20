import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApiKeyEnforcerScreen extends StatelessWidget {
  const ApiKeyEnforcerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'API Key Enforcer',
      apiPath: '/api/security-hardening/api-key-enforcer/list',
      columnLabels: ["Name", "Prefix", "Status"],
    );
  }
}
