import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AggregationCenterScreen extends StatelessWidget {
  const AggregationCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Aggregation Center',
      apiPath: '/api/agriculture-enhancement/aggregation-center/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
