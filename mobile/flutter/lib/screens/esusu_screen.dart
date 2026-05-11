import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EsusuScreen extends StatelessWidget {
  const EsusuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Esusu',
      apiEndpoint: '/api/esusu/v1/groups',
      columnKeys: const ['id', 'name', 'members', 'contribution', 'cycle'],
      columnLabels: const ['ID', 'Group', 'Members', 'Contribution', 'Cycle'],
      seedData: const [
      {'id': 'ESU-001', 'name': 'Lagos Market Women Ajo', 'members': '12', 'contribution': 'NGN 100K/mo', 'cycle': '12 months'},
    ],
    );
  }
}
