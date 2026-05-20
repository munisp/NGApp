import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CrossborderAgriTradeScreen extends StatelessWidget {
  const CrossborderAgriTradeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cross-Border Trade',
      apiPath: '/api/agriculture-enhancement/crossborder-agri-trade/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
