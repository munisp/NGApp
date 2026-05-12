import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class IpAllowlistScreen extends StatelessWidget {
  const IpAllowlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'IP Allowlist Engine',
      apiPath: '/api/security-hardening/ip-allowlist/list',
      columnLabels: ["Name", "CIDR", "Status"],
    );
  }
}
