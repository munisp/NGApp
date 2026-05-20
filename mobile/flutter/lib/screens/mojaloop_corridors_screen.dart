import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopCorridorsScreen extends StatelessWidget {
  const MojaloopCorridorsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cross-Border Corridors',
      apiEndpoint: '/api/platform/mojaloop/corridors',
      columnKeys: const ['name', 'region', 'sourceCurrency', 'destCurrency', 'exchangeRate', 'status'],
      columnLabels: const ['Name', 'Region', 'From', 'To', 'FX Rate', 'Status'],
      seedData: const [
              {'name': 'Nigeria to Ghana', 'region': 'ECOWAS', 'sourceCurrency': 'NGN', 'destCurrency': 'GHS', 'exchangeRate': '0.0076', 'status': 'active'},
              {'name': 'Nigeria to Kenya', 'region': 'PAN_AFRICAN', 'sourceCurrency': 'NGN', 'destCurrency': 'KES', 'exchangeRate': '0.087', 'status': 'active'},
      ],
    );
  }
}
