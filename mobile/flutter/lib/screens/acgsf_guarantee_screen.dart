import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AcgsfGuaranteeScreen extends StatelessWidget {
  const AcgsfGuaranteeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ACGSF Guarantee',
      apiPath: '/api/agriculture-enhancement/acgsf-guarantee/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
