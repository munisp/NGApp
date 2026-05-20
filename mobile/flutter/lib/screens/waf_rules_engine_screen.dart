import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WafRulesEngineScreen extends StatelessWidget {
  const WafRulesEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WAF Rules Engine',
      apiPath: '/api/security-hardening/waf-rules/list',
      columnLabels: ["Rule", "Name", "Status"],
    );
  }
}
