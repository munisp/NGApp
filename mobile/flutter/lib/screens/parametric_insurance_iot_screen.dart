import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ParametricInsuranceIotScreen extends StatelessWidget {
  const ParametricInsuranceIotScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Parametric Insurance',
      apiPath: '/api/agriculture-enhancement/parametric-insurance-iot/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
