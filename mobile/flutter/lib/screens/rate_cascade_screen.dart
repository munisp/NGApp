import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RateCascadeScreen extends StatelessWidget {
  const RateCascadeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Rate Cascade',
      apiEndpoint: '/api/rates/v1/cascade',
      columnKeys: const ['id', 'name', 'baseRate', 'spread', 'effective'],
      columnLabels: const ['ID', 'Name', 'Base', 'Spread', 'Effective'],
      seedData: const [
      {'id': 'RC-001', 'name': 'MPR', 'baseRate': '18.75%', 'spread': '0%', 'effective': '18.75%'},
    ],
    );
  }
}
