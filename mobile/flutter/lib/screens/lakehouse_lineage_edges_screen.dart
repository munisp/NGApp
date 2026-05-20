import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseLineageEdgesScreen extends StatelessWidget {
  const LakehouseLineageEdgesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Data Lineage Edges',
      apiEndpoint: '/api/platform/lakehouse/lineage/edges',
      columnKeys: const ['id', 'source', 'target', 'transformType', 'frequency'],
      columnLabels: const ['ID', 'Source', 'Target', 'Transform', 'Frequency'],
      seedData: const [
              {'id': 'LE-001', 'source': 'svc:core-banking-go', 'target': 'kafka:cdc.core-banking.accounts', 'transformType': 'cdc_publish', 'frequency': 'real-time'},
              {'id': 'LE-006', 'source': 'kafka:cdc.core-banking.accounts', 'target': 'table:accounts_cdc', 'transformType': 'kafka_consume', 'frequency': 'micro-batch 30s'},
      ],
    );
  }
}
