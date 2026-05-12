import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GoAMLIntegrationScreen extends StatelessWidget {
  const GoAMLIntegrationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'goAML NFIU Integration',
      apiPath: '/api/aml-enhancement/goaml-integration/list',
      columnLabels: ["Type", "Subject", "Amount"],
    );
  }
}
