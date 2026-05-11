import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DocCollectionsScreen extends StatelessWidget {
  const DocCollectionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Document Collections',
      apiEndpoint: '/api/doc-collections/v1/list',
      columnKeys: const ['id', 'customer', 'docs', 'complete', 'status'],
      columnLabels: const ['ID', 'Customer', 'Documents', 'Complete', 'Status'],
      seedData: const [
      {'id': 'DC-001', 'customer': 'Dangote Industries', 'docs': '12', 'complete': '100%', 'status': 'Complete'},
    ],
    );
  }
}
