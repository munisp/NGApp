import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PkceAuthFlowScreen extends StatelessWidget {
  const PkceAuthFlowScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PKCE Auth Flow',
      apiPath: '/api/security-hardening/pkce-auth/list',
      columnLabels: ["Client", "Method", "Status"],
    );
  }
}
