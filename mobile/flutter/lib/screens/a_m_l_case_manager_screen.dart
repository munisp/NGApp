import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AMLCaseManagerScreen extends StatelessWidget {
  const AMLCaseManagerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'AML Case Management',
      apiPath: '/api/aml-enhancement/aml-case-manager/list',
      columnLabels: ["Customer ID", "Customer", "Type"],
    );
  }
}
