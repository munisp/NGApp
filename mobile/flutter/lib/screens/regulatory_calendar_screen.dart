import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RegulatoryCalendarScreen extends StatelessWidget {
  const RegulatoryCalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Regulatory Calendar',
      apiEndpoint: '/api/regulatory/v1/calendar',
      columnKeys: const ['id', 'event', 'regulator', 'deadline', 'status'],
      columnLabels: const ['ID', 'Event', 'Regulator', 'Deadline', 'Status'],
      seedData: const [
      {'id': 'CAL-001', 'event': 'eFASS Submission', 'regulator': 'CBN', 'deadline': '2026-05-15', 'status': 'Upcoming'},
    ],
    );
  }
}
