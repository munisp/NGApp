import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SriValidatorScreen extends StatelessWidget {
  const SriValidatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SRI Validator',
      apiPath: '/api/security-hardening/sri-validator/list',
      columnLabels: ["Resource", "Violations", "Status"],
    );
  }
}
