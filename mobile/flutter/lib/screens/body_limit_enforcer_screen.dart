import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BodyLimitEnforcerScreen extends StatelessWidget {
  const BodyLimitEnforcerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Body Limit Enforcer',
      apiPath: '/api/security-hardening/body-limit/list',
      columnLabels: ["Path", "Max Bytes", "Status"],
    );
  }
}
