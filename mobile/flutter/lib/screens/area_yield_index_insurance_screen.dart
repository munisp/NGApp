import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AreaYieldIndexInsuranceScreen extends StatelessWidget {
  const AreaYieldIndexInsuranceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'AYII Insurance',
      apiPath: '/api/agriculture-enhancement/area-yield-index-insurance/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
