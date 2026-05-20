import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SecretsRotationScreen extends StatelessWidget {
  const SecretsRotationScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Secrets Rotation',
      apiEndpoint: '/api/production/secrets-rotation/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'SECRETS_ROTATION_SCREEN-001', 'status': 'active'},
        {'id': 'SECRETS_ROTATION_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
