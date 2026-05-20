import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CreditFacilitiesScreen extends StatelessWidget {
  const CreditFacilitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Credit Facilities',
      apiEndpoint: '/api/credit/v1/facilities',
      columnKeys: const ['id', 'customer', 'type', 'limit', 'utilized'],
      columnLabels: const ['ID', 'Customer', 'Type', 'Limit', 'Utilized'],
      seedData: const [
      {'id': 'CF-001', 'customer': 'Dangote Industries', 'type': 'Revolving', 'limit': 'NGN 50B', 'utilized': 'NGN 32B'},
    ],
    );
  }
}
