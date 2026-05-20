import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AdverseMediaScreen extends StatelessWidget {
  const AdverseMediaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Adverse Media Screening',
      apiEndpoint: '/api/kyc-enhanced/adverse-media',
      columnKeys: const ['id', 'entity', 'source', 'headline', 'riskImpact', 'detectedAt'],
      columnLabels: const ['ID', 'Entity', 'Source', 'Headline', 'Risk', 'Detected'],
      seedData: const [
        {'id': 'ADVERSE_MEDIA-001', 'status': 'active'},
        {'id': 'ADVERSE_MEDIA-002', 'status': 'pending'},
      ],
    );
  }
}
