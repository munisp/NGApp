import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CTRAutoFilerScreen extends StatelessWidget {
  const CTRAutoFilerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CTR Auto-Filing Engine',
      apiPath: '/api/aml-enhancement/ctr-auto-filer/list',
      columnLabels: ["Customer ID", "Customer", "Amount"],
    );
  }
}
