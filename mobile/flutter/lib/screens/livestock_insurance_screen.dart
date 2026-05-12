import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LivestockInsuranceScreen extends StatelessWidget {
  const LivestockInsuranceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Livestock Insurance',
      apiPath: '/api/agriculture-enhancement/livestock-insurance/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
