import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KedaAutoscalingScreen extends StatelessWidget {
  const KedaAutoscalingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'KEDA Autoscaling',
      apiEndpoint: '/api/platform/keda/scaled-objects',
      columnKeys: const ['name', 'service', 'currentReplicas', 'maxReplicas', 'status', 'cpu'],
      columnLabels: const ['Name', 'Service', 'Replicas', 'Max', 'Status', 'CPU'],
      seedData: const [
              {'name': 'so-core-banking', 'service': 'core-banking-go', 'currentReplicas': '5', 'maxReplicas': '20', 'status': 'active', 'cpu': '45%'},
              {'name': 'so-payments-hub', 'service': 'payments-hub-go', 'currentReplicas': '8', 'maxReplicas': '30', 'status': 'active', 'cpu': '72%'},
      ],
    );
  }
}
