import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KeepaliveTunerScreen extends StatelessWidget {
  const KeepaliveTunerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Keep-Alive Tuner',
      apiPath: '/api/performance/keepalive-tuner/list',
      columnLabels: ["Service", "Timeout (s)", "Reuse Rate"],
    );
  }
}
