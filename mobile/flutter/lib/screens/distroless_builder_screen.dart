import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DistrolessBuilderScreen extends StatelessWidget {
  const DistrolessBuilderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Distroless Builder',
      apiPath: '/api/performance/distroless-builder/list',
      columnLabels: ["Service", "Base Image", "Size MB"],
    );
  }
}
