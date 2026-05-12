import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EventCorrelatorScreen extends StatelessWidget {
  const EventCorrelatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Event Correlator',
      apiPath: '/api/security-hardening/event-correlator/list',
      columnLabels: ["Name", "Kill Chain", "Status"],
    );
  }
}
