import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InfraOpensearchScreen extends StatelessWidget {
  const InfraOpensearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Infra: OpenSearch',
      apiEndpoint: '/api/infra/v1/opensearch',
      columnKeys: const ['id', 'index', 'docs', 'size'],
      columnLabels: const ['ID', 'Index', 'Documents', 'Size'],
      seedData: const [
      {'id': 'OS-001', 'index': 'audit-logs', 'docs': '25M', 'size': '8 GB'},
    ],
    );
  }
}
