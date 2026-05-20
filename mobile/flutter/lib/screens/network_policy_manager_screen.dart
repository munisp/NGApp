import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NetworkPolicyManagerScreen extends StatelessWidget {
  const NetworkPolicyManagerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Network Policy Manager',
      apiPath: '/api/security-hardening/network-policy/list',
      columnLabels: ["Name", "Namespace", "Status"],
    );
  }
}
