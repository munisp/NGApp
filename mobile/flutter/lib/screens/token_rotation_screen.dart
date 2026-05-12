import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TokenRotationScreen extends StatelessWidget {
  const TokenRotationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Token Rotation',
      apiPath: '/api/security-hardening/token-rotation/list',
      columnLabels: ["Family", "Generation", "Status"],
    );
  }
}
