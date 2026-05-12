import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class JwtValidatorScreen extends StatelessWidget {
  const JwtValidatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'JWT Token Validator',
      apiPath: '/api/security-hardening/jwt-validator/list',
      columnLabels: ["Token Type", "Issuer", "Status"],
    );
  }
}
