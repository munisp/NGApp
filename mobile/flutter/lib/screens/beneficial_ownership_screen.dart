import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BeneficialOwnershipScreen extends StatelessWidget {
  const BeneficialOwnershipScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Beneficial Ownership Registry',
      apiPath: '/api/aml-enhancement/beneficial-ownership/list',
      columnLabels: ["Entity", "Type", "RC Number"],
    );
  }
}
