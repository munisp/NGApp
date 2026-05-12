import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HPAAutoscalerScreen extends StatelessWidget {
  const HPAAutoscalerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'HPA Autoscaler',
      apiPath: '/api/performance/hpa-autoscaler/list',
      columnLabels: ["Deployment", "Replicas", "CPU Target"],
    );
  }
}
