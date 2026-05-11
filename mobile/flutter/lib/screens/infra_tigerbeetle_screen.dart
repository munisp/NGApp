import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InfraTigerbeetleScreen extends StatelessWidget {
  const InfraTigerbeetleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Infra: TigerBeetle',
      apiEndpoint: '/api/infra/v1/tigerbeetle',
      columnKeys: const ['id', 'cluster', 'accounts', 'transfers'],
      columnLabels: const ['ID', 'Cluster', 'Accounts', 'Transfers/s'],
      seedData: const [
      {'id': 'TB-001', 'cluster': 'tb-prod', 'accounts': '500K', 'transfers': '25K/s'},
    ],
    );
  }
}
