import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ArtAdversarialScreen extends StatelessWidget {
  const ArtAdversarialScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ART Adversarial Robustness',
      apiEndpoint: '/api/ai-ml/art/models',
      columnKeys: const ['id', 'model', 'surface', 'robustness', 'cleanAcc'],
      columnLabels: const ['ID', 'Model', 'Surface', 'Robustness', 'Clean Acc'],
      seedData: const [
        {'id': 'ART_ADVERSARIAL-001', 'status': 'active'},
        {'id': 'ART_ADVERSARIAL-002', 'status': 'pending'},
      ],
    );
  }
}
