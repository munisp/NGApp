import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopCallbackEndpointsScreen extends StatelessWidget {
  const MojaloopCallbackEndpointsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Callback Endpoints',
      apiEndpoint: '/api/platform/mojaloop/callback-endpoints',
      columnKeys: const ['fspId', 'type', 'status', 'successRate', 'avgLatencyMs'],
      columnLabels: const ['FSP', 'Type', 'Status', 'Success', 'Latency'],
      seedData: const [
              {'fspId': '54BANK', 'type': 'TRANSFER_PUT', 'status': 'active', 'successRate': '0.999', 'avgLatencyMs': '15'},
              {'fspId': 'GTBANK', 'type': 'TRANSFER_PUT', 'status': 'active', 'successRate': '0.996', 'avgLatencyMs': '28'},
      ],
    );
  }
}
