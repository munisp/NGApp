import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DocumentManagementScreen extends StatelessWidget {
  const DocumentManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Documents',
      apiEndpoint: '/api/documents/v1/files',
      columnKeys: const ['id', 'type', 'fileName', 'status'],
      columnLabels: const ['ID', 'Type', 'File', 'Status'],
      seedData: const [
      {'id': 'DOC-001', 'type': 'NIN Slip', 'fileName': 'nin_adebayo.pdf', 'status': 'Verified'},
    ],
    );
  }
}
