import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FixedAssetsScreen extends StatelessWidget {
  const FixedAssetsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fixed Assets',
      apiEndpoint: '/api/assets/v1/register',
      columnKeys: const ['id', 'description', 'cost', 'nbv'],
      columnLabels: const ['ID', 'Description', 'Cost', 'NBV'],
      seedData: const [
      {'id': 'FA-001', 'description': 'Marina Head Office', 'cost': 'NGN 25B', 'nbv': 'NGN 20B'},
    ],
    );
  }
}
