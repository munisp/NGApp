import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EventDedupEngineScreen extends StatelessWidget {
  const EventDedupEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Event Dedup Engine',
      apiPath: '/api/performance/event-dedup/list',
      columnLabels: ["Topic", "Window (ms)", "Strategy"],
    );
  }
}
