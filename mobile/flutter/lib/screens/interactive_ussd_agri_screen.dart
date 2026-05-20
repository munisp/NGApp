import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InteractiveUssdAgriScreen extends StatelessWidget {
  const InteractiveUssdAgriScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'USSD Agriculture',
      apiPath: '/api/agriculture-enhancement/interactive-ussd-agri/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
