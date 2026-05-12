import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ClickjackDefenderScreen extends StatelessWidget {
  const ClickjackDefenderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Clickjack Defender',
      apiPath: '/api/security-hardening/clickjack-defender/list',
      columnLabels: ["Domain", "Ancestors", "Status"],
    );
  }
}
