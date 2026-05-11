import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SeedRegistryScreen extends StatelessWidget {
  const SeedRegistryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Seed Registry',
      apiEndpoint: '/api/seeds/v1/entities',
      columnKeys: const ['id', 'entity', 'records', 'lastSeed'],
      columnLabels: const ['ID', 'Entity', 'Records', 'Last Seed'],
      seedData: const [
      {'id': 'SR-001', 'entity': 'Customers', 'records': '245,000', 'lastSeed': '2026-05-09'},
    ],
    );
  }
}
