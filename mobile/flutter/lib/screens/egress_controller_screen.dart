import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EgressControllerScreen extends StatelessWidget {
  const EgressControllerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Egress Controller',
      apiPath: '/api/security-hardening/egress-controller/list',
      columnLabels: ["Name", "Protocol", "Status"],
    );
  }
}
