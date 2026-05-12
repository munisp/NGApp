import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SatelliteCropMonitorScreen extends StatelessWidget {
  const SatelliteCropMonitorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Satellite Monitor',
      apiPath: '/api/agriculture-enhancement/satellite-crop-monitor/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
