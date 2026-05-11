import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ServiceCatalogScreen extends StatelessWidget {
  const ServiceCatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Service Catalog',
      apiEndpoint: '/api/service-catalog/v1/modules',
      columnKeys: const ['id', 'name', 'category', 'status'],
      columnLabels: const ['ID', 'Module', 'Category', 'Status'],
      seedData: const [
      {'id': 'SC-001', 'name': 'Core Banking', 'category': 'Core', 'status': 'Enabled'},
      {'id': 'SC-002', 'name': 'Islamic Banking', 'category': 'Specialty', 'status': 'Optional'},
    ],
    );
  }
}
