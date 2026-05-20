import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class Soc2EvidenceScreen extends StatelessWidget {
  const Soc2EvidenceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SOC 2 Evidence',
      apiPath: '/api/security-hardening/soc2-evidence/list',
      columnLabels: ["Control", "Result", "Status"],
    );
  }
}
