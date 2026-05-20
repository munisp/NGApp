import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgentFarmerOnboardingScreen extends StatelessWidget {
  const AgentFarmerOnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agent Onboarding',
      apiPath: '/api/agriculture-enhancement/agent-farmer-onboarding/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
