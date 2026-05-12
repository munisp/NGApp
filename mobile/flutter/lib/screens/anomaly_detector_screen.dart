import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AnomalyDetectorScreen extends StatelessWidget {
  const AnomalyDetectorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Auth Anomaly Detector',
      apiPath: '/api/security-hardening/anomaly-detector/list',
      columnLabels: ["Name", "Accuracy", "Status"],
    );
  }
}
