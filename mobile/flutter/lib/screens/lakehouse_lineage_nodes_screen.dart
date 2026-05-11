import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseLineageNodesScreen extends StatelessWidget {
  const LakehouseLineageNodesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Data Lineage Nodes',
      apiEndpoint: '/api/platform/lakehouse/lineage/nodes',
      columnKeys: const ['id', 'name', 'type', 'domain'],
      columnLabels: const ['ID', 'Name', 'Type', 'Domain'],
      seedData: const [
              {'id': 'svc:core-banking-go', 'name': 'Core Banking (Go)', 'type': 'service', 'domain': 'core_banking'},
              {'id': 'kafka:cdc.payments.transfers', 'name': 'cdc.payments.transfers', 'type': 'kafka_topic', 'domain': 'payments'},
              {'id': 'table:customer_360', 'name': 'customer_360', 'type': 'gold_table', 'domain': 'core_banking'},
      ],
    );
  }
}
