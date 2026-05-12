import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SoilAnalysisScreen extends StatelessWidget {
  const SoilAnalysisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Soil Analysis',
      apiPath: '/api/agriculture-enhancement/soil-analysis/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
