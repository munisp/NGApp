import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AdverseMediaScannerScreen extends StatelessWidget {
  const AdverseMediaScannerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Adverse Media Deep Scanner',
      apiPath: '/api/aml-enhancement/adverse-media-scanner/list',
      columnLabels: ["Customer ID", "Customer", "Relevant Articles"],
    );
  }
}
