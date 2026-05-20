import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RequestCoalescerScreen extends StatelessWidget {
  const RequestCoalescerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Request Coalescer',
      apiPath: '/api/performance/request-coalescer/list',
      columnLabels: ["Route", "Window (ms)", "Savings"],
    );
  }
}
