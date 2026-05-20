import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KafkaGovernanceScreen extends StatelessWidget {
  const KafkaGovernanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Kafka Schema Governance',
      apiEndpoint: '/api/ai-ml/kafka-governance/schemas',
      columnKeys: const ['id', 'subject', 'version', 'type', 'fields'],
      columnLabels: const ['ID', 'Subject', 'Version', 'Type', 'Fields'],
      seedData: const [
        {'id': 'KAFKA_GOVERNANCE-001', 'status': 'active'},
        {'id': 'KAFKA_GOVERNANCE-002', 'status': 'pending'},
      ],
    );
  }
}
