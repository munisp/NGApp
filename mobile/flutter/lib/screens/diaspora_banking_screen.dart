import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DiasporaBankingScreen extends StatelessWidget {
  const DiasporaBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Diaspora Banking',
      apiEndpoint: '/api/diaspora/v1/accounts',
      columnKeys: const ['id', 'name', 'country', 'type', 'balance'],
      columnLabels: const ['ID', 'Name', 'Country', 'Type', 'Balance'],
      seedData: const [
      {'id': 'DIA-001', 'name': 'Emeka Obi (UK)', 'country': 'UK', 'type': 'Domiciliary', 'balance': 'GBP 25,000'},
    ],
    );
  }
}
