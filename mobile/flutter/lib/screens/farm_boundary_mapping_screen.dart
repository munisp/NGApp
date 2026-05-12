import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FarmBoundaryMappingScreen extends StatelessWidget {
  const FarmBoundaryMappingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Farm Mapping',
      apiPath: '/api/agriculture-enhancement/farm-boundary-mapping/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
