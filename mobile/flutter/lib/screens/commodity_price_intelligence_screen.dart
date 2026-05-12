import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CommodityPriceIntelligenceScreen extends StatelessWidget {
  const CommodityPriceIntelligenceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Price Intelligence',
      apiPath: '/api/agriculture-enhancement/commodity-price-intelligence/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
