import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LivestockFinanceScreen extends StatelessWidget {
  const LivestockFinanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Livestock Finance',
      apiPath: '/api/agriculture-enhancement/livestock-finance/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
