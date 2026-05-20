import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RelationshipPricingScreen extends StatelessWidget {
  const RelationshipPricingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Relationship Pricing',
      apiEndpoint: '/api/pricing/v1/relationships',
      columnKeys: const ['id', 'customer', 'tier', 'discount'],
      columnLabels: const ['ID', 'Customer', 'Tier', 'Discount'],
      seedData: const [
      {'id': 'RP-001', 'customer': 'Dangote Group', 'tier': 'Platinum', 'discount': '25%'},
    ],
    );
  }
}
