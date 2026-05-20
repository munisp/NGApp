import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ComponentShowcaseScreen extends StatelessWidget {
  const ComponentShowcaseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Component Showcase',
      apiEndpoint: '/api/ui/v1/components',
      columnKeys: const ['name', 'type', 'status'],
      columnLabels: const ['Component', 'Type', 'Status'],
      seedData: const [
      {'name': 'DataTable', 'type': 'Display', 'status': 'Stable'},
      {'name': 'SearchBar', 'type': 'Input', 'status': 'Stable'},
    ],
    );
  }
}
