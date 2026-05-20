import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DdosShieldScreen extends StatelessWidget {
  const DdosShieldScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'DDoS Shield',
      apiPath: '/api/security-hardening/ddos-shield/list',
      columnLabels: ["Name", "Layer", "Status"],
    );
  }
}
