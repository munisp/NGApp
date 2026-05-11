import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ProxyRoutesScreen extends StatelessWidget {
  const ProxyRoutesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Proxy Routes',
      apiEndpoint: '/api/platform/service-mesh/proxy-routes',
      columnKeys: const ['expressPath', 'upstream', 'method', 'timeoutMs', 'retries'],
      columnLabels: const ['Path', 'Upstream', 'Method', 'Timeout', 'Retries'],
      seedData: const [
              {'expressPath': '/api/accounts', 'upstream': 'core-banking-go', 'method': 'GET', 'timeoutMs': '5000', 'retries': '2'},
      ],
    );
  }
}
