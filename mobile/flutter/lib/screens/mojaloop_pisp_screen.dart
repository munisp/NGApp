import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopPispScreen extends StatelessWidget {
  const MojaloopPispScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Mojaloop PISP Consents',
      apiEndpoint: '/api/ai-ml/mojaloop-pisp/consents',
      columnKeys: const ['id', 'pisp', 'dfsp', 'customerId', 'status'],
      columnLabels: const ['ID', 'PISP', 'DFSP', 'Customer', 'Status'],
      seedData: const [
        {'id': 'MOJALOOP_PISP-001', 'status': 'active'},
        {'id': 'MOJALOOP_PISP-002', 'status': 'pending'},
      ],
    );
  }
}
