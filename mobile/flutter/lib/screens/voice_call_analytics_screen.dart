import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceCallAnalyticsScreen extends StatelessWidget {
  const VoiceCallAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Voice Call Analytics',
      apiPath: '/api/channel-banking/voice-call-analytics/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
