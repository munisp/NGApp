import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TypologyDetectorScreen extends StatelessWidget {
  const TypologyDetectorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ML/TF Typology Detector',
      apiPath: '/api/aml-enhancement/typology-detector/list',
      columnLabels: ["Code", "Typology", "Risk"],
    );
  }
}
