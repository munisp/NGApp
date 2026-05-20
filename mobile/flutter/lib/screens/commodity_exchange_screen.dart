import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CommodityExchangeScreen extends StatelessWidget {
  const CommodityExchangeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Commodity Exchange',
      apiPath: '/api/agriculture-enhancement/commodity-exchange/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
