import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PluginMarketplaceScreen extends StatelessWidget {
  const PluginMarketplaceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Plugin Marketplace',
      apiEndpoint: '/api/plugins/v1/list',
      columnKeys: const ['id', 'name', 'vendor', 'installs', 'status'],
      columnLabels: const ['ID', 'Plugin', 'Vendor', 'Installs', 'Status'],
      seedData: const [
      {'id': 'PLG-001', 'name': 'Receipt OCR', 'vendor': '54Bank Labs', 'installs': '45', 'status': 'Published'},
    ],
    );
  }
}
