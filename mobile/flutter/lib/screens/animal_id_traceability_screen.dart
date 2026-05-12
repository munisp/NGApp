import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AnimalIdTraceabilityScreen extends StatelessWidget {
  const AnimalIdTraceabilityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Animal Traceability',
      apiPath: '/api/agriculture-enhancement/animal-id-traceability/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
